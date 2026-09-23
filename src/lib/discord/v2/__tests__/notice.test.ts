import {
	EmbedBuilder,
	MessageFlags,
	MessageFlagsBitField,
	type RepliableInteraction,
} from 'discord.js'
import { describe, expect, it, vi } from 'vitest'
import { sendErrorNotice } from '../notice.js'
import { expectV2Payload } from './v2-assert.js'

const v2Msg = () => ({
	id: 'v2',
	flags: new MessageFlagsBitField(MessageFlags.IsComponentsV2),
})
const classicMsg = () => ({ id: 'classic', flags: new MessageFlagsBitField(0) })

const embed = () =>
	new EmbedBuilder()
		.setTitle('Invalid Bet')
		.setDescription('Not enough money')
		.setColor(0xff0000)

function fake(opts: {
	deferred?: boolean
	replied?: boolean
	message?: unknown
	fetchReply?: () => Promise<unknown>
}) {
	const i = {
		deferred: opts.deferred ?? false,
		replied: opts.replied ?? false,
		fetchReply: vi.fn(opts.fetchReply ?? (async () => classicMsg())),
		editReply: vi.fn(async (_p: unknown) => ({ id: 'edited' })),
		followUp: vi.fn(async (_p: unknown) => ({ id: 'followup' })),
		reply: vi.fn(async (_p: unknown) => ({
			resource: { message: { id: 'reply' } },
		})),
		...('message' in opts ? { message: opts.message } : {}),
	}
	return i as typeof i & RepliableInteraction
}

function expectV2Followup(i: ReturnType<typeof fake>) {
	expect(i.editReply).not.toHaveBeenCalled()
	expect(i.reply).not.toHaveBeenCalled()
	expect(i.followUp).toHaveBeenCalledTimes(1)
	const payload = i.followUp.mock.calls[0]![0] as never as Parameters<
		typeof expectV2Payload
	>[0]
	// container + one text display
	expectV2Payload(payload, {
		flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
		components: 2,
	})
	expect('ephemeral' in payload).toBe(false)
	const container = (
		payload.components![0] as { toJSON(): unknown }
	).toJSON() as { accent_color?: number; components: { content: string }[] }
	expect(container.accent_color).toBe(0xff0000)
	expect(container.components[0]!.content).toBe(
		'**Invalid Bet**\nNot enough money',
	)
}

describe('sendErrorNotice', () => {
	it('button deferred on a V2 message → V2 ephemeral follow-up, never edits', async () => {
		const msg = v2Msg()
		const i = fake({
			deferred: true,
			message: msg,
			fetchReply: async () => msg,
		})
		const res = await sendErrorNotice(i, embed())
		expect(res.branch).toBe('v2-followup')
		expect(res.message).toEqual({ id: 'followup' })
		expectV2Followup(i)
	})

	it('component: fetchReply throws → falls back to interaction.message (V2)', async () => {
		const i = fake({
			deferred: true,
			message: v2Msg(),
			fetchReply: async () => {
				throw new Error('Unknown Message')
			},
		})
		const res = await sendErrorNotice(i, embed())
		expect(res.branch).toBe('v2-followup')
		expectV2Followup(i)
	})

	it('chat-input deferred + fetchReply returns V2 message → V2 follow-up', async () => {
		const i = fake({ deferred: true, fetchReply: async () => v2Msg() })
		const res = await sendErrorNotice(i, embed())
		expect(i.fetchReply).toHaveBeenCalledTimes(1)
		expect(res.branch).toBe('v2-followup')
		expectV2Followup(i)
	})

	it('chat-input replied + fetchReply returns V2 message → V2 follow-up', async () => {
		const i = fake({ replied: true, fetchReply: async () => v2Msg() })
		expect((await sendErrorNotice(i, embed())).branch).toBe('v2-followup')
		expectV2Followup(i)
	})

	it('chat-input deferred + fetchReply throws → classic edit', async () => {
		const i = fake({
			deferred: true,
			fetchReply: async () => {
				throw new Error('boom')
			},
		})
		const e = embed()
		const res = await sendErrorNotice(i, e)
		expect(res).toEqual({
			branch: 'classic-edit',
			message: { id: 'edited' },
		})
		expect(i.editReply).toHaveBeenCalledWith({ embeds: [e] })
		expect(i.followUp).not.toHaveBeenCalled()
	})

	it('deferred placeholder (classic, empty) → classic editReply({ embeds })', async () => {
		const i = fake({ deferred: true })
		const e = embed()
		const res = await sendErrorNotice(i, e)
		expect(res.branch).toBe('classic-edit')
		expect(i.editReply).toHaveBeenCalledTimes(1)
		expect(i.editReply).toHaveBeenCalledWith({ embeds: [e] })
		expect(i.followUp).not.toHaveBeenCalled()
	})

	it('button deferred on a classic message → classic edit', async () => {
		const msg = classicMsg()
		const i = fake({
			deferred: true,
			message: msg,
			fetchReply: async () => msg,
		})
		expect((await sendErrorNotice(i, embed())).branch).toBe('classic-edit')
		expect(i.editReply).toHaveBeenCalledTimes(1)
	})

	it('classic target uses opts.classic instead of the default edit', async () => {
		const i = fake({ deferred: true })
		const classic = vi.fn(async () => ({ id: 'custom' }) as never)
		const e = embed()
		const res = await sendErrorNotice(i, e, { classic })
		expect(classic).toHaveBeenCalledWith(e)
		expect(i.editReply).not.toHaveBeenCalled()
		expect(res).toEqual({
			branch: 'classic-edit',
			message: { id: 'custom' },
		})
	})

	it('opts.classic is not called on a V2 target', async () => {
		const i = fake({ deferred: true, fetchReply: async () => v2Msg() })
		const classic = vi.fn()
		await sendErrorNotice(i, embed(), { classic })
		expect(classic).not.toHaveBeenCalled()
	})

	it('not deferred/replied → classic ephemeral reply, no fetch', async () => {
		const i = fake({ message: v2Msg() })
		const e = embed()
		const res = await sendErrorNotice(i, e)
		expect(res).toEqual({
			branch: 'classic-reply',
			message: { id: 'reply' },
		})
		expect(i.fetchReply).not.toHaveBeenCalled()
		expect(i.reply).toHaveBeenCalledWith({
			embeds: [e],
			flags: MessageFlags.Ephemeral,
			withResponse: true,
		})
		expect(i.editReply).not.toHaveBeenCalled()
		expect(i.followUp).not.toHaveBeenCalled()
	})

	it('omits accent when the embed has no colour', async () => {
		const i = fake({ deferred: true, fetchReply: async () => v2Msg() })
		await sendErrorNotice(i, new EmbedBuilder().setTitle('T'))
		const payload = i.followUp.mock.calls[0]![0] as {
			components: {
				toJSON(): {
					accent_color?: number
					components: { content: string }[]
				}
			}[]
		}
		const json = payload.components[0]!.toJSON()
		expect(json.accent_color).toBeUndefined()
		expect(json.components[0]!.content).toBe('**T**')
	})

	it('falls back to generic text when the embed has no title or description', async () => {
		const i = fake({ deferred: true, fetchReply: async () => v2Msg() })
		await sendErrorNotice(i, new EmbedBuilder())
		const payload = i.followUp.mock.calls[0]![0] as {
			components: { toJSON(): { components: { content: string }[] } }[]
		}
		expect(payload.components[0]!.toJSON().components[0]!.content).toBe(
			'Something went wrong. Please try again.',
		)
	})
})
