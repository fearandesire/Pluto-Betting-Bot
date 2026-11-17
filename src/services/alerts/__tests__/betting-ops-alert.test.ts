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
	webhookUrlFor,
} from '../betting-ops-alert.js'

// A standard channel-settings webhook, as Discord issues it.
const WEBHOOK = 'https://discord.com/api/webhooks/123456789012345678/token-abc'
const V2_FLAG = 1 << 15

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

const okResponse = () => new Response(null, { status: 200 })
const rejectedResponse = () => new Response('{}', { status: 400 })

type Call = [string, RequestInit]
const callAt = (send: { mock: { calls: unknown[][] } }, i: number) =>
	send.mock.calls[i] as unknown as Call
const bodyAt = (send: { mock: { calls: unknown[][] } }, i: number) =>
	JSON.parse(callAt(send, i)[1].body as string)

function harness(
	send = vi.fn(async (_url: string, _init: RequestInit) => okResponse()),
) {
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

describe('webhookUrlFor', () => {
	it('adds with_components and wait to a standard webhook URL', () => {
		const url = new URL(webhookUrlFor(WEBHOOK))
		expect(url.origin + url.pathname).toBe(WEBHOOK)
		expect(url.searchParams.get('with_components')).toBe('true')
		expect(url.searchParams.get('wait')).toBe('true')
	})

	it('keeps other query parameters such as thread_id', () => {
		const url = new URL(webhookUrlFor(`${WEBHOOK}?thread_id=42`))
		expect(url.searchParams.get('thread_id')).toBe('42')
		expect(url.searchParams.get('with_components')).toBe('true')
	})

	it('is idempotent', () => {
		const once = webhookUrlFor(WEBHOOK)
		expect(webhookUrlFor(once)).toBe(once)
	})
})

describe('createBettingOpsAlerter transport', () => {
	it('posts a Components V2 payload with no content or embeds to the with_components URL', async () => {
		const { send, alerter } = harness()
		alerter.report(failure())
		await flush()

		expect(send).toHaveBeenCalledTimes(1)
		expect(
			new URL(callAt(send, 0)[0]).searchParams.get('with_components'),
		).toBe('true')
		const sent = bodyAt(send, 0)
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
		expect(sent.content).toBeUndefined()
		expect(sent.flags & V2_FLAG).toBeTruthy()
		expect(sent.components.length).toBeGreaterThan(0)
	})

	it('falls back to a separate plain-text message when the V2 message is rejected', async () => {
		const send = vi
			.fn(async (_url: string, _init: RequestInit) => rejectedResponse())
			.mockResolvedValueOnce(rejectedResponse())
			.mockResolvedValueOnce(okResponse())
		const { alerter } = harness(send)
		alerter.report(failure())
		await flush()

		expect(send).toHaveBeenCalledTimes(2)
		const fallback = bodyAt(send, 1)
		expect(fallback.flags).toBeUndefined()
		expect(fallback.allowed_mentions).toEqual({ parse: [] })
		expect(fallback.components).toBeUndefined()
		expect(typeof fallback.content).toBe('string')
		expect(fallback.content).toContain('command.failed')
		expect(fallback.content).toContain('/bet')
		expect(fallback.content.length).toBeLessThanOrEqual(2000)
	})

	it('sends nothing extra when the V2 message is accepted', async () => {
		const { send, alerter } = harness()
		alerter.report(failure())
		await flush()
		expect(send).toHaveBeenCalledTimes(1)
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
		expect(JSON.stringify(bodyAt(send, 1))).toContain('2 repeat(s)')
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
})

describe('describeError', () => {
	it('redacts URLs from the error text so the webhook address never reaches the channel', () => {
		const text = describeError(new Error(`request to ${WEBHOOK} failed`))
		expect(text).not.toContain('token-abc')
		expect(text).toContain('[url]')
	})
})
