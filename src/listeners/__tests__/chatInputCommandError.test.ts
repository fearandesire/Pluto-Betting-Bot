import { MessageFlags, MessageFlagsBitField } from 'discord.js'
import { describe, expect, it, vi } from 'vitest'
import { ChatInputCommandError } from '../chatInputCommandError.js'

vi.mock('../../utils/api/Khronos/guild/guild-wrapper.js', () => ({
	default: class {},
}))
vi.mock('../../utils/logging/WinstonLogger.js', () => ({
	createLogger: () => ({ error: vi.fn(), warn: vi.fn() }),
}))

const DESCRIPTION =
	'An unexpected error occurred while running this command. The issue has been logged and will be looked into.'

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
		user: { id: 'u' },
	}
}

const run = (i: ReturnType<typeof chatInput>) =>
	(
		ChatInputCommandError.prototype as never as {
			replyWithErrorEmbed(i: unknown, name: string): Promise<void>
		}
	).replyWithErrorEmbed.call({}, i, 'cmd')

const embedOf = (call: unknown[]) =>
	(call[0] as { embeds: { data: { title: string; description: string } }[] })
		.embeds[0]!.data

describe('ChatInputCommandError user-facing reply', () => {
	it('deferred V2 reply → V2 ephemeral follow-up, never edits with embeds', async () => {
		const i = chatInput({ deferred: true, v2: true })
		await run(i)
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
		await run(i)
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
		await run(i)
		expect(i.editReply).not.toHaveBeenCalled()
		expect(i.followUp).toHaveBeenCalledTimes(1)
		const payload = i.followUp.mock.calls[0]![0] as { flags: number }
		expect(payload.flags).toBe(MessageFlags.Ephemeral)
		expect(embedOf(i.followUp.mock.calls[0]!).title).toBe(
			'Something went wrong',
		)
	})

	it('fresh interaction → ephemeral embed reply', async () => {
		const i = chatInput({})
		await run(i)
		expect(i.reply).toHaveBeenCalledTimes(1)
		const payload = i.reply.mock.calls[0]![0] as { flags: number }
		expect(payload.flags).toBe(MessageFlags.Ephemeral)
		expect(embedOf(i.reply.mock.calls[0]!).description).toBe(DESCRIPTION)
	})
})
