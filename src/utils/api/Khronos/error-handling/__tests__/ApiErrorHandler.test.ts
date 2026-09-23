import {
	type ButtonInteraction,
	MessageFlags,
	MessageFlagsBitField,
} from 'discord.js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
	ApiHttpErrorTypes,
	ApiModules,
} from '../../../../../lib/interfaces/api/api.interface.js'
import { ApiErrorHandler } from '../ApiErrorHandler.js'

vi.mock('@pluto-config', () => ({ helpfooter: async () => 'help' }))

const msg = (flags: number) => ({
	id: `m${flags}`,
	flags: new MessageFlagsBitField(flags),
	deletable: true,
	channel: {},
	delete: vi.fn(),
})

function button(target: ReturnType<typeof msg>) {
	return {
		deferred: true,
		replied: false,
		message: target,
		fetchReply: vi.fn(async () => target),
		editReply: vi.fn(async (_p: unknown) => msg(0)),
		followUp: vi.fn(async (_p: unknown) => msg(MessageFlags.Ephemeral)),
		reply: vi.fn((_p: unknown) => {}),
	}
}

const apiError = {
	exception: ApiHttpErrorTypes.InsufficientBalance,
	message: 'x',
	details: { balance: 5 },
}

afterEach(() => vi.useRealTimers())

describe('ApiErrorHandler on a V2 message', () => {
	it('button deferred on a V2 message: zero editReply calls with embeds, V2 follow-up, no auto-delete', async () => {
		vi.useFakeTimers()
		const target = msg(MessageFlags.IsComponentsV2)
		const i = button(target)
		await new ApiErrorHandler().handle(
			i as never as ButtonInteraction,
			apiError,
			ApiModules.betting,
		)
		const embedEdits = i.editReply.mock.calls.filter(
			(c) => c[0] && typeof c[0] === 'object' && 'embeds' in c[0],
		)
		expect(embedEdits).toHaveLength(0)
		expect(i.followUp).toHaveBeenCalledTimes(1)
		expect((i.followUp.mock.calls[0]![0] as { flags: number }).flags).toBe(
			MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
		)
		expect(vi.getTimerCount()).toBe(0)
	})

	it('classic deferred reply keeps editReply({ embeds }) and the 30s auto-delete', async () => {
		vi.useFakeTimers()
		const i = button(msg(0))
		const sent = await new ApiErrorHandler().handle(
			i as never as ButtonInteraction,
			apiError,
			ApiModules.betting,
		)
		expect(i.editReply).toHaveBeenCalledTimes(1)
		const embed = (
			i.editReply.mock.calls[0]![0] as {
				embeds: { data: { title?: string; description?: string } }[]
			}
		).embeds[0]!
		expect(embed.data.title).toBe('Invalid Bet')
		expect(embed.data.description).toBe(
			'You only have **`$5.00`** available to place bets with.',
		)
		expect(i.followUp).not.toHaveBeenCalled()
		expect(vi.getTimerCount()).toBe(1)
		await vi.advanceTimersByTimeAsync(30000)
		expect(sent.delete).toHaveBeenCalledTimes(1)
	})
})
