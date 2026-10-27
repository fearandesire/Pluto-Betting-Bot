import { describe, expect, it, vi } from 'vitest'

vi.mock('../KhronosInstances.js', () => ({ KH_API_CONFIG: {} }))

const { default: AchievementsWrapper, isAchievementsApiAvailable } =
	await import('./achievements-wrapper.js')

const dto = {
	user_id: 'u1',
	earned: [],
	locked: [],
	summary: {
		settled_bets: 0,
		wins: 0,
		losses: 0,
		pushes: 0,
		net_profit: 0,
		best_win_payout: null,
		settled_predictions: 0,
		prediction_hit_rate: null,
	},
}

describe('AchievementsWrapper', () => {
	it('throws a clear error when the generated client lacks AchievementsApi', () => {
		expect(isAchievementsApiAvailable()).toBe(false)
		expect(() => new AchievementsWrapper()).toThrow(
			/AchievementsApi is unavailable/,
		)
	})

	it('delegates evaluate and get to the injected client', async () => {
		const client = {
			evaluateUserAchievements: vi.fn(async () => dto),
			getUserAchievements: vi.fn(async () => dto),
		}
		const wrapper = new AchievementsWrapper(client)

		await expect(wrapper.evaluateUserAchievements('u1')).resolves.toBe(dto)
		await expect(wrapper.getUserAchievements('u1')).resolves.toBe(dto)
		expect(client.evaluateUserAchievements).toHaveBeenCalledWith('u1')
		expect(client.getUserAchievements).toHaveBeenCalledWith('u1')
	})

	it('propagates client failures', async () => {
		const wrapper = new AchievementsWrapper({
			evaluateUserAchievements: vi.fn(async () => {
				throw new Error('boom')
			}),
			getUserAchievements: vi.fn(),
		})
		await expect(wrapper.evaluateUserAchievements('u1')).rejects.toThrow(
			'boom',
		)
	})
})
