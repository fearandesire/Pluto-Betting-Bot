import { beforeEach, describe, expect, it, vi } from 'vitest'

const logger = vi.hoisted(() => ({
	error: vi.fn(),
	warn: vi.fn(),
	info: vi.fn(),
}))

vi.mock('../../../../logging/WinstonLogger.js', () => ({ logger }))

import {
	validateDailyPropsPayload,
	validateNotifyBetUsers,
} from '../notification-utils.js'

describe('notification payload validators', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it('accepts a typed bet-results payload and preserves result discriminators', () => {
		const result = validateNotifyBetUsers({
			winners: [
				{
					userId: 'user-1',
					betId: 101,
					result: {
						team: 'Home',
						betAmount: 10,
						payout: 20,
						profit: 10,
						newBalance: 110,
						oldBalance: 100,
					},
				},
			],
			losers: null,
			pushes: [],
		})

		expect(result?.winners).toHaveLength(1)
		expect(result?.winners[0].result.outcome).toBe('won')
		expect(result?.losers).toEqual([])
		expect(logger.error).not.toHaveBeenCalled()
	})

	it('accepts a winner without a bet id from the current shared contract', () => {
		const result = validateNotifyBetUsers({
			winners: [
				{
					userId: 'user-1',
					result: { team: 'Home', betAmount: 10 },
				},
			],
			losers: [],
		})

		expect(result?.winners).toHaveLength(1)
		expect(result?.winners[0].betId).toBeUndefined()
		expect(result?.winners[0].result.outcome).toBe('won')
		expect(logger.error).not.toHaveBeenCalled()
	})

	it('normalizes legacy flat push entries from the published package', () => {
		const result = validateNotifyBetUsers({
			winners: [],
			losers: [],
			pushes: [
				{ userid: 'user-2', amount: 15, betid: 202, team: 'Away' },
			],
		})

		expect(result?.pushes).toEqual([
			{
				userId: 'user-2',
				betId: 202,
				result: { outcome: 'push', team: 'Away', betAmount: 15 },
			},
		])
	})

	it('accepts a realistic daily props payload', () => {
		const result = validateDailyPropsPayload({
			props: [
				{
					event_id: 'event-1',
					commence_time: '2026-07-11T00:00:00Z',
					home_team: 'Home',
					away_team: 'Away',
					sport_title: 'NBA',
					market_key: 'player_points',
					bookmaker_key: 'draftkings',
					description: 'Player',
					point: 20.5,
					over: {
						outcome_uuid: '550e8400-e29b-41d4-a716-446655440000',
						outcome_name: 'Over',
						price: -110,
					},
					under: {
						outcome_uuid: '550e8400-e29b-41d4-a716-446655440001',
						outcome_name: 'Under',
						price: -110,
					},
				},
			],
			guilds: [
				{ guild_id: 'guild-1', channel_id: 'channel-1', sport: 'nba' },
			],
		})

		expect(result?.props).toHaveLength(1)
		expect(logger.error).not.toHaveBeenCalled()
	})

	it('rejects a daily props payload with an invalid guild channel', () => {
		const result = validateDailyPropsPayload({
			props: [],
			guilds: [{ guild_id: 42, channel_id: 'channel-1', sport: 'nba' }],
		})

		expect(result).toBeNull()
		expect(logger.error).toHaveBeenCalledWith(
			expect.objectContaining({
				event: 'push_payload_rejected',
				schema: 'dailyPropsPayload',
			}),
		)
	})
})
