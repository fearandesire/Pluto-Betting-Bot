import { MessageFlags, MessageFlagsBitField } from 'discord.js'
import { describe, expect, it, vi } from 'vitest'
import { ChatInputCommandError } from '../chatInputCommandError.js'

vi.mock('../../utils/api/Khronos/guild/guild-wrapper.js', () => ({
	default: class {},
}))
vi.mock('../../utils/logging/WinstonLogger.js', () => ({
	createLogger: () => ({ error: vi.fn(), warn: vi.fn() }),
}))
vi.mock('../../services/alerts/betting-ops-alert.js', () => ({
	reportBettingFailure: vi.fn(),
}))

const DESCRIPTION =
	'An unexpected error occurred while running this command. The issue has been logged and will be looked into.'
const UNCONFIRMED =
	"We couldn't confirm your bet. Check /mybets before you try again.\nReference: `23456789`"

function chatInput(state: {
	deferred?: boolean
	replied?: boolean
	v2?: boolean
}) {
	return {
		deferred: state.deferred ?? false,
		replied: state.replied ?? false,
		fetchReply: vi.fn(async () => ({
			flags: new MessageFlagsBitField(
				state.v2 ? MessageFlags.IsComponentsV2 : 0,
			),
		})),
		editReply: vi.fn(async (_p: unknown) => ({})),
		followUp: vi.fn(async (_p: unknown) => ({})),
		reply: vi.fn(async (_p: unknown) => ({ resource: { message: {} } })),
		deleteReply: vi.fn(async () => undefined),
		id: '1234567890123456789',
		user: { id: 'u' },
	}
}

const replyWith = (i: ReturnType<typeof chatInput>, name: string) =>
	(
		ChatInputCommandError.prototype as never as {
			replyWithErrorEmbed(i: unknown, name: string): Promise<void>
		}
	).replyWithErrorEmbed.call({}, i, name)

const embedOf = (call: unknown[]) =>
	(call[0] as { embeds: { data: { title: string; description: string } }[] })
		.embeds[0]!.data

/** The Components V2 text of a payload, flattened to a string for assertions. */
const v2TextOf = (payload: unknown) => JSON.stringify(payload)

describe('ChatInputCommandError user-facing reply', () => {
	it('deferred V2 reply → V2 ephemeral follow-up, never edits with embeds', async () => {
		const i = chatInput({ deferred: true, v2: true })
		await replyWith(i, 'cmd')
		expect(i.editReply).not.toHaveBeenCalled()
		expect(i.followUp).toHaveBeenCalledTimes(1)
		const payload = i.followUp.mock.calls[0]![0] as Record<string, unknown>
		expect(payload.flags).toBe(
			MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
		)
		expect('embeds' in payload).toBe(false)
		expect('content' in payload).toBe(false)
	})

	it('deferred classic → editReply({ embeds }) exactly as before', async () => {
		const i = chatInput({ deferred: true })
		await replyWith(i, 'cmd')
		expect(i.editReply).toHaveBeenCalledTimes(1)
		expect(Object.keys(i.editReply.mock.calls[0]![0] as object)).toEqual([
			'embeds',
		])
		expect(embedOf(i.editReply.mock.calls[0]!)).toMatchObject({
			title: 'Something went wrong',
			description: DESCRIPTION,
		})
		expect(i.followUp).not.toHaveBeenCalled()
	})

	it('replied classic → ephemeral embed follow-up as before', async () => {
		const i = chatInput({ replied: true })
		await replyWith(i, 'cmd')
		expect(i.editReply).not.toHaveBeenCalled()
		expect(i.followUp).toHaveBeenCalledTimes(1)
		const payload = i.followUp.mock.calls[0]![0] as { flags: number }
		expect(payload.flags).toBe(MessageFlags.Ephemeral)
		expect(embedOf(i.followUp.mock.calls[0]!).title).toBe(
			'Something went wrong',
		)
	})

	it('fresh non-betting interaction → ephemeral embed reply', async () => {
		const i = chatInput({})
		await replyWith(i, 'cmd')
		expect(i.reply).toHaveBeenCalledTimes(1)
		const payload = i.reply.mock.calls[0]![0] as { flags: number }
		expect(payload.flags).toBe(MessageFlags.Ephemeral)
		expect(embedOf(i.reply.mock.calls[0]!).description).toBe(DESCRIPTION)
	})

	it('placement failure on a fresh interaction → V2 "Bet not confirmed" notice with a reference', async () => {
		const i = chatInput({})
		await replyWith(i, 'bet')
		expect(i.reply).toHaveBeenCalledTimes(1)
		const payload = i.reply.mock.calls[0]![0] as Record<string, unknown>
		expect(payload.flags).toBe(
			MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
		)
		expect('embeds' in payload).toBe(false)
		const text = v2TextOf(payload)
		expect(text).toContain('Bet not confirmed')
		expect(text).toContain(UNCONFIRMED.replaceAll('\n', '\\n'))
		expect(text).not.toContain('not placed')
	})

	it('placement failure on a deferred interaction removes the spinner and sends V2 as a follow-up', async () => {
		const i = chatInput({ deferred: true })
		await replyWith(i, 'bet')
		expect(i.deleteReply).toHaveBeenCalledTimes(1)
		expect(i.editReply).not.toHaveBeenCalled()
		expect(i.followUp).toHaveBeenCalledTimes(1)
		const payload = i.followUp.mock.calls[0]![0] as Record<string, unknown>
		expect(payload.flags).toBe(
			MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
		)
		expect(v2TextOf(payload)).toContain('Bet not confirmed')
	})
})
