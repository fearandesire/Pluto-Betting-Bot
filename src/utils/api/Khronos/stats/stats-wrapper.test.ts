import { describe, expect, it, vi } from 'vitest'

vi.mock('../KhronosInstances.js', () => ({
	KH_API_CONFIG: {},
}))

const { parsePredictionStats } = await import('./stats-wrapper.js')

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
})
