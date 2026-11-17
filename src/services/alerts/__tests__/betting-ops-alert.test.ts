import { describe, expect, it, vi } from 'vitest'

vi.mock('../../../lib/startup/env.js', () => ({
	default: { BETTING_OPS_WEBHOOK_URL: undefined, PROJECT_VERSION: 'v0' },
}))
vi.mock('../../../utils/logging/WinstonLogger.js', () => ({
	logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}))

import {
	BETTING_OPS_DEDUPE_MS,
	type BettingOpsFailure,
	createBettingOpsAlerter,
	describeError,
} from '../betting-ops-alert.js'

const WEBHOOK = 'https://discord.example.invalid/api/webhooks/1/secret-token'

const failure = (overrides: Partial<BettingOpsFailure> = {}) => ({
	key: 'command.failed:bet:TypeError',
	event: 'command.failed' as const,
	command: 'bet',
	guildId: '1',
	channelId: '2',
	userId: '3',
	requestId: '1234567890123456789',
	error: new TypeError('boom'),
	...overrides,
})

const okResponse = () => new Response(null, { status: 204 })

function harness(send = vi.fn(async () => okResponse())) {
	let t = 1_000_000
	const alerter = createBettingOpsAlerter({
		url: WEBHOOK,
		version: 'v4.20.0',
		fetch: send as unknown as typeof fetch,
		now: () => t,
	})
	return {
		send,
		alerter,
		advance: (ms: number) => {
			t += ms
		},
	}
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('createBettingOpsAlerter', () => {
	it('posts one embed with the failure context and the version', async () => {
		const { send, alerter } = harness()
		alerter.report(failure())
		await flush()

		expect(send).toHaveBeenCalledTimes(1)
		const [url, init] = send.mock.calls[0] as unknown as [
			string,
			RequestInit,
		]
		expect(url).toBe(WEBHOOK)
		const sent = JSON.parse(init.body as string)
		const text = JSON.stringify(sent)
		expect(text).toContain('Critical betting failure')
		expect(text).toContain('service=pluto · v4.20.0')
		expect(text).toContain('**Event:** command.failed')
		expect(text).toContain('**Command:** /bet')
		expect(text).toContain('**Guild:** 1')
		expect(text).toContain('**User:** 3')
		expect(text).toContain('**Request:** 1234567890123456789')
		expect(text).toContain('TypeError: boom')
		expect(sent.embeds).toBeUndefined()
		expect(sent.flags & (1 << 15)).toBeTruthy()
	})

	it('sends at most once per key inside the dedupe window and counts the repeats', async () => {
		const { send, alerter, advance } = harness()
		alerter.report(failure())
		alerter.report(failure())
		alerter.report(failure())
		await flush()
		expect(send).toHaveBeenCalledTimes(1)

		advance(BETTING_OPS_DEDUPE_MS)
		alerter.report(failure())
		await flush()

		expect(send).toHaveBeenCalledTimes(2)
		const body = JSON.parse(
			(send.mock.calls[1] as unknown as [string, RequestInit])[1]
				.body as string,
		)
		expect(JSON.stringify(body)).toContain('2 repeat(s)')
	})

	it('keeps a different key on its own window', async () => {
		const { send, alerter } = harness()
		alerter.report(failure({ key: 'command.failed:bet:TypeError' }))
		alerter.report(
			failure({
				key: 'interaction.expired_before_ack:odds:DiscordAPIError',
			}),
		)
		await flush()
		expect(send).toHaveBeenCalledTimes(2)
	})

	it('never throws when the webhook is down or hangs', async () => {
		const { alerter } = harness(
			vi.fn(async () => {
				throw new Error('network down')
			}),
		)
		expect(() => alerter.report(failure())).not.toThrow()
		await flush()
	})

	it('redacts URLs from the error text so the webhook address never reaches the channel', () => {
		const text = describeError(new Error(`request to ${WEBHOOK} failed`))
		expect(text).not.toContain('secret-token')
		expect(text).toContain('[url]')
	})
})
