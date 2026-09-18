import { describe, expect, it, vi } from 'vitest'

const fetchApi = vi.fn()

vi.mock('../KhronosInstances.js', () => ({
	KH_API_CONFIG: {
		basePath: 'https://khronos.test/',
		headers: { 'x-api-key': 'test-key' },
		fetchApi,
	},
}))

const { default: LeaderboardWrapper, parseLeaderboardWithStreaks } =
	await import('./leaderboard-wrapper.js')

describe('parseLeaderboardWithStreaks', () => {
	it('preserves streak fields from the raw snake-case wire response', () => {
		expect(
			parseLeaderboardWithStreaks({
				entries: [
					{
						user_id: 'user-1',
						total_predictions: 12,
						correct_predictions: 9,
						incorrect_predictions: 3,
						success_rate: 75,
						current_streak: 4,
						best_streak: 7,
						badge_tier: 5,
					},
				],
				total_users: 1,
			}),
		).toEqual({
			entries: [
				{
					user_id: 'user-1',
					total_predictions: 12,
					correct_predictions: 9,
					incorrect_predictions: 3,
					success_rate: 75,
					current_streak: 4,
					best_streak: 7,
					badge_tier: 5,
				},
			],
			total_users: 1,
		})
	})

	it('normalizes camel-case fields and missing streak fields', () => {
		expect(
			parseLeaderboardWithStreaks({
				entries: [
					{
						userId: 'user-2',
						totalPredictions: 0,
						correctPredictions: 0,
						incorrectPredictions: 0,
						successRate: 0,
					},
				],
				totalUsers: 1,
			}),
		).toMatchObject({
			entries: [
				{
					user_id: 'user-2',
					current_streak: 0,
					best_streak: 0,
					badge_tier: null,
				},
			],
			total_users: 1,
		})
	})
})

describe('LeaderboardWrapper', () => {
	it('uses the raw transport so generated DTOs cannot drop streak fields', async () => {
		fetchApi.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => ({
				entries: [
					{
						user_id: 'user-1',
						total_predictions: 10,
						correct_predictions: 8,
						incorrect_predictions: 2,
						success_rate: 80,
						current_streak: 3,
						best_streak: 5,
						badge_tier: 3,
					},
				],
				total_users: 1,
			}),
		})

		await expect(
			new LeaderboardWrapper().getLeaderboard({ guildId: 'guild/1' }),
		).resolves.toMatchObject({
			entries: [{ current_streak: 3, best_streak: 5, badge_tier: 3 }],
		})
		expect(fetchApi).toHaveBeenCalledWith(
			'https://khronos.test/api/khronos/v1/leaderboard?guild_id=guild%2F1',
			expect.objectContaining({
				method: 'GET',
				headers: expect.objectContaining({
					'x-api-key': 'test-key',
					Accept: 'application/json',
				}),
			}),
		)
	})

	it('surfaces non-success responses instead of returning an empty leaderboard', async () => {
		fetchApi.mockResolvedValueOnce({ ok: false, status: 503 })

		await expect(
			new LeaderboardWrapper().getLeaderboard({ guildId: 'guild-1' }),
		).rejects.toThrow('Khronos leaderboard request failed (503)')
	})
})
