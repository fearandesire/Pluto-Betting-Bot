import { MessageFlags } from 'discord.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
	expectV2Payload,
	toJsonComponents,
} from '../../test/helpers/v2-assert.js'

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

const { encodePageNav, registerPageSource } = await import(
	'../../lib/discord/v2/paginator.js'
)
const { V2PaginationHandler } = await import('../v2-pagination-handler.js')

const load = vi.fn()
registerPageSource('h-owned', { load, ownerOnly: true })
registerPageSource('h-open', { load })

function makeInteraction(opts: {
	customId: string
	userId?: string
	ownerId?: string
}) {
	return {
		customId: opts.customId,
		user: { id: opts.userId ?? 'owner' },
		message: {
			interactionMetadata: opts.ownerId
				? { user: { id: opts.ownerId } }
				: null,
		},
		reply: vi.fn(),
		deferUpdate: vi.fn(),
		editReply: vi.fn(),
	}
}

function firstText(payload: unknown): string | undefined {
	const [container] = toJsonComponents(payload as never) as Array<{
		components?: Array<{ content?: string }>
	}>
	return container.components?.[0]?.content
}

const pageData = {
	scope: 'h-owned',
	title: 'Board',
	lines: Array.from({ length: 30 }, (_, i) => `row ${i}`),
	page: 1,
	perPage: 10,
}

describe('V2PaginationHandler', () => {
	const handler = new V2PaginationHandler({} as never, {} as never)

	beforeEach(() => {
		vi.clearAllMocks()
		load.mockResolvedValue(pageData)
	})

	it('parse returns some(route) for a pg.v1 id without acknowledging', () => {
		const i = makeInteraction({
			customId: encodePageNav({
				scope: 'h-owned',
				page: 1,
				action: 'next',
			}),
		})
		expect(handler.parse(i as never)).toEqual({
			kind: 'some',
			value: { scope: 'h-owned', page: 1, action: 'next' },
		})
		expect(i.deferUpdate).not.toHaveBeenCalled()
		expect(i.reply).not.toHaveBeenCalled()
	})

	it.each([
		'prop_abc',
		'matchup_btn_confirm',
		'pg.v2.h-owned.1.next',
	])('parse returns none for %s', (customId) => {
		const i = makeInteraction({ customId })
		expect(handler.parse(i as never)).toEqual({ kind: 'none' })
	})

	it('rejects a non-owner with an ephemeral V2 notice and does not load', async () => {
		const i = makeInteraction({
			customId: 'pg.v1.h-owned.1.next',
			userId: 'intruder',
			ownerId: 'owner',
		})
		await handler.run(i as never, {
			scope: 'h-owned',
			page: 1,
			action: 'next',
		})
		expect(i.reply).toHaveBeenCalledTimes(1)
		const payload = i.reply.mock.calls[0][0]
		expectV2Payload(payload, {
			flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
			components: 2,
		})
		expect(firstText(payload)).toBe(
			'Only the person who ran this command can use these buttons.',
		)
		expect(i.deferUpdate).not.toHaveBeenCalled()
		expect(load).not.toHaveBeenCalled()
	})

	it('rejects when the source message has no interaction metadata', async () => {
		const i = makeInteraction({ customId: 'pg.v1.h-owned.1.next' })
		await handler.run(i as never, {
			scope: 'h-owned',
			page: 1,
			action: 'next',
		})
		expect(i.reply).toHaveBeenCalledTimes(1)
		expect(load).not.toHaveBeenCalled()
	})

	it('owner: defers update, loads the target page, and edits with V2 flags only', async () => {
		const i = makeInteraction({
			customId: 'pg.v1.h-owned.1.next',
			userId: 'owner',
			ownerId: 'owner',
		})
		await handler.run(i as never, {
			scope: 'h-owned',
			page: 1,
			action: 'next',
		})
		expect(i.deferUpdate).toHaveBeenCalledTimes(1)
		expect(load).toHaveBeenCalledWith(i, 1)
		expect(i.editReply).toHaveBeenCalledTimes(1)
		const payload = i.editReply.mock.calls[0][0]
		// container + title + body + footer + row + 4 buttons
		expectV2Payload(payload, {
			flags: MessageFlags.IsComponentsV2,
			components: 9,
		})
		expect(firstText(payload)).toBe('## Board')
		expect(i.deferUpdate.mock.invocationCallOrder[0]).toBeLessThan(
			load.mock.invocationCallOrder[0],
		)
	})

	it('non-owner-only sources let anyone page', async () => {
		const i = makeInteraction({
			customId: 'pg.v1.h-open.2.last',
			userId: 'someone',
			ownerId: 'owner',
		})
		await handler.run(i as never, {
			scope: 'h-open',
			page: 2,
			action: 'last',
		})
		expect(i.reply).not.toHaveBeenCalled()
		expect(i.editReply).toHaveBeenCalledTimes(1)
	})

	it('strips Ephemeral from edits even if the source asks for it', async () => {
		load.mockResolvedValue({ ...pageData, ephemeral: true })
		const i = makeInteraction({
			customId: 'pg.v1.h-open.1.next',
		})
		await handler.run(i as never, {
			scope: 'h-open',
			page: 1,
			action: 'next',
		})
		expect(i.editReply.mock.calls[0][0].flags).toBe(
			MessageFlags.IsComponentsV2,
		)
	})

	it('unknown scope replies with an ephemeral expired notice', async () => {
		const i = makeInteraction({ customId: 'pg.v1.gone.0.next' })
		await handler.run(i as never, {
			scope: 'gone',
			page: 0,
			action: 'next',
		})
		expect(i.reply).toHaveBeenCalledTimes(1)
		const payload = i.reply.mock.calls[0][0]
		expectV2Payload(payload, {
			flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
			components: 2,
		})
		expect(firstText(payload)).toBe(
			'This menu expired — run the command again.',
		)
		expect(i.deferUpdate).not.toHaveBeenCalled()
	})
})
