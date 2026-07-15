import { afterEach, describe, expect, it, vi } from 'vitest'
import type { InitParlayRequest } from '../../api/Khronos/parlays/ParlayApiWrapper.js'

vi.mock('../../../lib/startup/env.js', () => ({
	default: {
		NODE_ENV: 'development',
		MOCK_GUILD_SPORT: 'nba',
		MOCK_GUILD_BETTING_CHAN_ID: '123456789012345678',
		DEV_GUILD_GAMES_CATEGORY_ID: '123456789012345678',
	},
}))

const { MockBackend } = await import('../mock-backend.js')

describe('MockBackend parlay lifecycle', () => {
	afterEach(() => {
		vi.useRealTimers()
	})

	function request(overrides: Partial<InitParlayRequest> = {}) {
		return {
			legs: [
				{ event_id: 'event-1', outcome_uuid: 'event-1-home' },
				{ event_id: 'event-2', outcome_uuid: 'event-2-away' },
			],
			stake: 10,
			guild_id: 'guild-1',
			user_id: 'user-1',
			...overrides,
		}
	}

	it('preserves spread and totals market metadata in mock parlays', () => {
		const backend = MockBackend.instance()
		backend.reset()
		const games = backend.seedGames('nba', 2).matches
		const game = games[0]
		const secondGame = games[1]
		if (!game?.id || !secondGame?.id) throw new Error('mock games missing')

		const preview = backend.initParlay({
			legs: [
				{
					event_id: game.id,
					outcome_uuid: `${game.id}-spread-home`,
				},
				{
					event_id: secondGame.id,
					outcome_uuid: `${secondGame.id}-total-over`,
				},
			],
			stake: 10,
			guild_id: 'guild-1',
			user_id: 'user-1',
		})

		expect(preview.legs.map((leg) => leg.market_key)).toEqual([
			'spreads',
			'totals',
		])
		expect(backend.placeParlay(preview.init_token).legs).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ market_key: 'spreads' }),
				expect.objectContaining({ market_key: 'totals' }),
			]),
		)
	})

	it('rejects same-event legs, unsupported markets, and out-of-range requests', () => {
		const backend = MockBackend.instance()
		backend.reset()

		expect(() =>
			backend.initParlay(
				request({
					legs: [
						{ event_id: 'event-1', outcome_uuid: 'event-1-home' },
						{ event_id: 'event-1', outcome_uuid: 'event-1-away' },
					],
				}),
			),
		).toThrow('distinct events')
		expect(() =>
			backend.initParlay({
				...request(),
				legs: [
					...request().legs,
					{
						event_id: 'event-3',
						outcome_uuid: 'event-3-player-points',
					},
				],
			}),
		).toThrow('supported')
		expect(() => backend.initParlay({ ...request(), legs: [] })).toThrow(
			'between 2 and 6',
		)
		expect(() =>
			backend.initParlay({
				...request(),
				legs: Array.from({ length: 7 }, (_, index) => ({
					event_id: `event-${index + 1}`,
					outcome_uuid: `event-${index + 1}-home`,
				})),
			}),
		).toThrow('between 2 and 6')
		expect(() => backend.initParlay({ ...request(), stake: 0 })).toThrow(
			'between 1 and 10000',
		)
		expect(() =>
			backend.initParlay({ ...request(), stake: 10_001 }),
		).toThrow('between 1 and 10000')
	})

	it('uses a 15-minute one-time token and rejects it at the expiry boundary', () => {
		const backend = MockBackend.instance()
		backend.reset()
		const now = new Date('2026-07-15T12:00:00.000Z')
		vi.useFakeTimers({ now })

		const preview = backend.initParlay(request())
		expect(preview.expires_at).toBe('2026-07-15T12:15:00.000Z')
		vi.advanceTimersByTime(15 * 60 * 1000 - 1)
		const placed = backend.placeParlay(preview.init_token)
		expect(placed.status).toBe('pending')
		vi.setSystemTime(now)
		const expired = backend.initParlay(request({ user_id: 'user-2' }))
		vi.advanceTimersByTime(15 * 60 * 1000)
		expect(() => backend.placeParlay(expired.init_token)).toThrow('expired')
	})

	it('debits once for a token and does not debit on replay', () => {
		const backend = MockBackend.instance()
		backend.reset()
		backend.setBalance('user-1', 100)
		const preview = backend.initParlay(request({ stake: 80 }))

		backend.placeParlay(preview.init_token)
		expect(backend.getAccountBalance('user-1').balance).toBe(20)
		expect(() => backend.placeParlay(preview.init_token)).toThrow('expired')
		expect(backend.getAccountBalance('user-1').balance).toBe(20)
	})

	it('refunds cancellation once and closes cancellation at first commence time', () => {
		const backend = MockBackend.instance()
		backend.reset()
		backend.setBalance('user-1', 100)
		const preview = backend.initParlay(request({ stake: 25 }))
		const placed = backend.placeParlay(preview.init_token)

		const cancelled = backend.cancelParlay(placed.id, 'user-1')
		expect(cancelled.status).toBe('cancelled')
		expect(cancelled.actual_payout).toBe(25)
		expect(backend.getAccountBalance('user-1').balance).toBe(100)
		expect(() => backend.cancelParlay(placed.id, 'user-1')).toThrow(
			'no longer cancellable',
		)
		expect(backend.getAccountBalance('user-1').balance).toBe(100)

		const future = backend.placeParlay(
			backend.initParlay(request()).init_token,
		)
		vi.setSystemTime(new Date(future.legs[0]?.commence_time ?? now()))
		expect(() => backend.cancelParlay(future.id, 'user-1')).toThrow(
			'cancellation window has closed',
		)
	})

	it('settles terminal states, credits winnings, and notifies exactly once', () => {
		const backend = MockBackend.instance()
		backend.reset()
		backend.setBalance('user-1', 100)
		const notifications: string[] = []
		const unsubscribe = backend.onParlayTerminal((parlay) => {
			notifications.push(`${parlay.id}:${parlay.status}`)
		})
		const preview = backend.initParlay(request({ stake: 10 }))
		const placed = backend.placeParlay(preview.init_token)

		const pending = backend.settleParlayLeg(
			placed.id,
			'event-1-home',
			'won',
		)
		expect(pending.status).toBe('pending')
		const settled = backend.settleParlayLeg(
			placed.id,
			'event-2-away',
			'won',
		)
		expect(settled.status).toBe('won')
		expect(settled.actual_payout).toBe(preview.potential_payout)
		expect(backend.getAccountBalance('user-1').balance).toBe(
			100 - 10 + preview.potential_payout,
		)
		expect(notifications).toEqual([`${placed.id}:won`])
		expect(() =>
			backend.settleParlayLeg(placed.id, 'event-2-away', 'lost'),
		).toThrow('terminal')
		unsubscribe()
	})

	it('refunds all-push/void parlays and rejects illegal leg transitions', () => {
		const backend = MockBackend.instance()
		backend.reset()
		backend.setBalance('user-1', 100)
		const preview = backend.initParlay(request({ stake: 10 }))
		const placed = backend.placeParlay(preview.init_token)

		backend.settleParlayLeg(placed.id, 'event-1-home', 'push')
		const refunded = backend.settleParlayLeg(
			placed.id,
			'event-2-away',
			'void',
		)
		expect(refunded.status).toBe('push_refunded')
		expect(refunded.actual_payout).toBe(10)
		expect(backend.getAccountBalance('user-1').balance).toBe(100)
		expect(() =>
			backend.settleParlayLeg(placed.id, 'event-1-home', 'won'),
		).toThrow('terminal')
	})
})

function now(): string {
	return new Date().toISOString()
}
