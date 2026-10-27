import { StatsApi } from '@pluto-khronos/api-client'
import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ fetchApi: vi.fn() }))

vi.mock('../KhronosInstances.js', () => ({
	KH_API_CONFIG: {
		basePath: 'https://khronos.test/',
		headers: { 'x-api-key': 'test-key' },
		fetchApi: mocks.fetchApi,
	},
}))

const {
	default: StatsWrapper,
	PropStatsUnavailableError,
	parsePredictionStats,
} = await import('./stats-wrapper.js')

describe('parsePredictionStats', () => {
	it('accepts both generated camel-case and wire snake-case fields', () => {
		expect(
			parsePredictionStats({
				userId: 'user-1',
				correctPredictions: 9,
				incorrectPredictions: 3,
				totalPredictions: 12,
				successRate: 75,
				currentStreak: 4,
				bestStreak: 7,
				badgeTier: 3,
			}),
		).toEqual({
			user_id: 'user-1',
			correct_predictions: 9,
			incorrect_predictions: 3,
			total_predictions: 12,
			success_rate: 75,
			current_streak: 4,
			best_streak: 7,
			badge_tier: 3,
		})

		expect(
			parsePredictionStats({
				user_id: 'user-2',
				correct_predictions: 0,
				incorrect_predictions: 0,
				total_predictions: 0,
				success_rate: 0,
				current_streak: 0,
				best_streak: 0,
				badge_tier: null,
			}),
		).toMatchObject({ user_id: 'user-2', badge_tier: null })
	})

	it('normalizes a trailing-slash base URL for the raw stats transport', async () => {
		mocks.fetchApi.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => ({
				user_id: 'user-1',
				correct_predictions: 9,
				incorrect_predictions: 3,
				total_predictions: 12,
				success_rate: 75,
				current_streak: 4,
				best_streak: 7,
				badge_tier: 3,
			}),
		})

		await new StatsWrapper().getPredictionStats({
			userId: 'user-1',
			guildId: 'guild-1',
		})

		expect(mocks.fetchApi).toHaveBeenCalledWith(
			'https://khronos.test/api/khronos/v1/prediction/stats/user-1?guild_id=guild-1',
			expect.anything(),
		)
	})
})

describe('getPropBettingStats', () => {
	afterEach(() => {
		delete (StatsApi.prototype as unknown as Record<string, unknown>)
			.getPropBettingStats
	})

	it('throws a clear error when the generated client lacks the method', async () => {
		await expect(
			new StatsWrapper().getPropBettingStats({ userId: 'user-1' }),
		).rejects.toBeInstanceOf(PropStatsUnavailableError)
	})

	it('delegates to the generated client with the request', async () => {
		const payload = { user_id: 'user-1', markets: [] }
		const method = vi.fn().mockResolvedValue(payload)
		;(
			StatsApi.prototype as unknown as Record<string, unknown>
		).getPropBettingStats = method

		const request = {
			userId: 'user-1',
			sport: 'nba' as const,
			guildId: 'g1',
		}
		await expect(
			new StatsWrapper().getPropBettingStats(request),
		).resolves.toBe(payload)
		expect(method).toHaveBeenCalledWith(request)
	})
})
