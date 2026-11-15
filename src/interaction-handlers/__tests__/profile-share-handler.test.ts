import { MessageFlags } from 'discord.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { toJsonComponents } from '../../lib/discord/v2/__tests__/v2-assert.js'

vi.mock('@sapphire/framework', () => ({
	InteractionHandler: class {
		public none() {
			return { kind: 'none' }
		}
		public some(value: unknown) {
			return { kind: 'some', value }
		}
	},
	InteractionHandlerTypes: { Button: 'button' },
}))

vi.mock('../../utils/logging/WinstonLogger.js', () => ({
	logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}))

const { ProfileShareHandler } = await import('../profile-share-handler.js')
const { encodeProfileShare } = await import(
	'../../lib/discord/builders/profile.js'
)

const OWNER = '111111111111111111'
const TARGET = '222222222222222222'
const OTHER = '333333333333333333'
const CDN_URL = 'https://cdn.discordapp.com/attachments/1/2/profile-card.png'
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3])

let messageSeq = 0

function makeInteraction(
	opts: {
		userId?: string
		attachmentUrl?: string | null
		badgeLine?: string
	} = {},
) {
	messageSeq += 1
	const url = opts.attachmentUrl === undefined ? CDN_URL : opts.attachmentUrl
	return {
		customId: encodeProfileShare({ ownerId: OWNER, targetId: TARGET }),
		user: { id: opts.userId ?? OWNER },
		message: {
			id: `message-${messageSeq}`,
			attachments: { first: () => (url ? { url } : undefined) },
			components: opts.badgeLine
				? [
						{
							toJSON: () => ({
								type: 17,
								components: [
									{ type: 12, items: [] },
									{ type: 10, content: opts.badgeLine },
									{ type: 1, components: [] },
								],
							}),
						},
					]
				: [],
		},
		reply: vi.fn(),
		deferUpdate: vi.fn(),
		editReply: vi.fn(),
		followUp: vi.fn(),
	}
}

function makeHandler() {
	return new ProfileShareHandler({} as never, {} as never)
}

function firstText(payload: unknown): string | undefined {
	const [container] = toJsonComponents(payload as never) as Array<{
		components?: Array<{ content?: string }>
	}>
	return container.components?.[0]?.content
}

describe('ProfileShareHandler', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => ({
				ok: true,
				status: 200,
				arrayBuffer: async () =>
					PNG.buffer.slice(
						PNG.byteOffset,
						PNG.byteOffset + PNG.byteLength,
					),
			})),
		)
	})

	describe('parse', () => {
		it('accepts only profile share custom IDs', () => {
			const handler = makeHandler()
			const parse = (customId: string) =>
				handler.parse({ customId } as never)
			expect(parse(`profile.v1.share.${OWNER}.${TARGET}`)).toMatchObject({
				kind: 'some',
				value: { ownerId: OWNER, targetId: TARGET },
			})
			expect(parse('pg.v1.scope.0.next')).toEqual({ kind: 'none' })
			expect(parse('profile.v2.share.1.2')).toEqual({ kind: 'none' })
			expect(parse(`profile.v1.share.${OWNER}`)).toEqual({ kind: 'none' })
			expect(parse(`profile.v1.share.${OWNER}.${TARGET}.x`)).toEqual({
				kind: 'none',
			})
		})
	})

	it('ignores other users with a private notice and shares nothing', async () => {
		const interaction = makeInteraction({ userId: OTHER })
		await makeHandler().run(interaction as never, {
			ownerId: OWNER,
			targetId: TARGET,
		})

		const payload = interaction.reply.mock.calls[0][0]
		expect(payload.flags & MessageFlags.Ephemeral).toBeTruthy()
		expect(firstText(payload)).toMatch(/Only the person who ran/)
		expect(interaction.deferUpdate).not.toHaveBeenCalled()
		expect(interaction.followUp).not.toHaveBeenCalled()
		expect(interaction.editReply).not.toHaveBeenCalled()
		expect(fetch).not.toHaveBeenCalled()
	})

	it('posts the card publicly once, then disables the button', async () => {
		const interaction = makeInteraction()
		const handler = makeHandler()
		const route = { ownerId: OWNER, targetId: TARGET }
		await handler.run(interaction as never, route)

		expect(fetch).toHaveBeenCalledWith(CDN_URL)
		expect(interaction.deferUpdate).toHaveBeenCalledOnce()

		const shared = interaction.followUp.mock.calls[0][0]
		expect(shared.flags & MessageFlags.Ephemeral).toBeFalsy()
		expect(shared.allowedMentions).toEqual({ parse: [] })
		expect(shared.files[0].attachment).toEqual(PNG)

		const edit = interaction.editReply.mock.calls[0][0]
		const row = toJsonComponents(edit)[0].components?.slice(-1)[0] as {
			components: Array<{ disabled?: boolean }>
		}
		expect(row.components[0].disabled).toBeFalsy()
		expect(row.components[1].disabled).toBe(true)
		expect(edit.flags & MessageFlags.Ephemeral).toBeFalsy()

		// A second click on the same message must not post again.
		await handler.run(interaction as never, route)
		expect(interaction.followUp).toHaveBeenCalledOnce()
		expect(firstText(interaction.reply.mock.calls[0][0])).toMatch(
			/already shared/,
		)
	})

	it('refuses attachments that are not on the Discord CDN', async () => {
		const interaction = makeInteraction({
			attachmentUrl: 'https://evil.example/profile-card.png',
		})
		await makeHandler().run(interaction as never, {
			ownerId: OWNER,
			targetId: TARGET,
		})
		expect(fetch).not.toHaveBeenCalled()
		expect(interaction.followUp).toHaveBeenCalledOnce()
		expect(firstText(interaction.followUp.mock.calls[0][0])).toMatch(
			/Couldn't share/,
		)
		expect(interaction.editReply).not.toHaveBeenCalled()
	})

	it('releases the claim when sharing fails so the user can retry', async () => {
		vi.stubGlobal(
			'fetch',
			vi
				.fn()
				.mockResolvedValueOnce({ ok: false, status: 500 })
				.mockResolvedValue({
					ok: true,
					status: 200,
					arrayBuffer: async () => new Uint8Array(PNG).buffer,
				}),
		)
		const interaction = makeInteraction()
		const handler = makeHandler()
		const route = { ownerId: OWNER, targetId: TARGET }
		await handler.run(interaction as never, route)
		expect(firstText(interaction.followUp.mock.calls[0][0])).toMatch(
			/Couldn't share/,
		)

		await handler.run(interaction as never, route)
		expect(interaction.followUp).toHaveBeenCalledTimes(2)
		expect(interaction.editReply).toHaveBeenCalledOnce()
	})

	it('releases the claim when deferring the update fails', async () => {
		const interaction = makeInteraction()
		interaction.deferUpdate.mockRejectedValueOnce(new Error('expired'))
		const handler = makeHandler()
		const route = { ownerId: OWNER, targetId: TARGET }
		await handler.run(interaction as never, route)

		await handler.run(interaction as never, route)
		expect(interaction.reply).not.toHaveBeenCalled()
		expect(interaction.editReply).toHaveBeenCalledOnce()
	})

	it('forgets claims after the interaction window so the set stays bounded', async () => {
		vi.useFakeTimers()
		try {
			const interaction = makeInteraction()
			const handler = makeHandler()
			const route = { ownerId: OWNER, targetId: TARGET }
			await handler.run(interaction as never, route)
			vi.advanceTimersByTime(16 * 60 * 1000)

			await handler.run(interaction as never, route)
			expect(interaction.reply).not.toHaveBeenCalled()
		} finally {
			vi.useRealTimers()
		}
	})

	it('does not re-post when only the button update fails', async () => {
		const interaction = makeInteraction()
		interaction.editReply.mockRejectedValue(new Error('token expired'))
		const handler = makeHandler()
		const route = { ownerId: OWNER, targetId: TARGET }
		await handler.run(interaction as never, route)
		await handler.run(interaction as never, route)
		expect(interaction.followUp).toHaveBeenCalledOnce()
	})

	it('carries the badge line to the public post and the rebuilt reply', async () => {
		const interaction = makeInteraction({
			badgeLine: 'Opening Score · 1 of 10 badges',
		})
		await makeHandler().run(interaction as never, {
			ownerId: OWNER,
			targetId: TARGET,
		})
		const texts = (payload: unknown) =>
			(
				toJsonComponents(payload as never)[0].components as Array<{
					content?: string
				}>
			)
				.map((c) => c.content)
				.filter(Boolean)
		expect(texts(interaction.followUp.mock.calls[0][0])).toEqual([
			'Opening Score · 1 of 10 badges',
			`-# Shared by <@${OWNER}>`,
		])
		expect(texts(interaction.editReply.mock.calls[0][0])).toEqual([
			'Opening Score · 1 of 10 badges',
		])
	})

	it('posts a pre-deploy card exactly as before', async () => {
		const interaction = makeInteraction()
		await makeHandler().run(interaction as never, {
			ownerId: OWNER,
			targetId: TARGET,
		})
		const shared = interaction.followUp.mock.calls[0][0]
		expect(toJsonComponents(shared)[0].components).toHaveLength(2)
		expect(
			(
				toJsonComponents(shared)[0].components as Array<{
					content?: string
				}>
			)[1].content,
		).toBe(`-# Shared by <@${OWNER}>`)
	})
})
