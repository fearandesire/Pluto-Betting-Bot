import { describe, expect, it, vi } from 'vitest'

vi.mock('../../logging/WinstonLogger.js', () => ({
	logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

const { loadProfileViewData } = await import('../load-profile-view.js')
const { buildBadgeEmojiRegistry } = await import(
	'../../../lib/badges/badge-emoji-registry.js'
)

const dto = {
	user_id: 'u',
	earned: [
		{
			key: 'first_win',
			name: 'First Win',
			description: '',
			awarded_at: '2026-10-01T12:00:00.000Z',
		},
	],
	locked: [],
	summary: {
		settled_bets: 9,
		wins: 5,
		losses: 3,
		pushes: 1,
		net_profit: 42.5,
		best_win_payout: null,
		settled_predictions: 0,
		prediction_hit_rate: null,
	},
}
const achievements = {
	evaluateUserAchievements: async () => dto,
	getUserAchievements: async () => dto,
}
const subject = { userId: '1', displayName: 'Carl', avatarUrl: null }
const emoji = buildBadgeEmojiRegistry([])

describe('loadProfileViewData', () => {
	it('carries the saved view through untouched and builds the model', async () => {
		const loaded = await loadProfileViewData(
			{
				accounts: {
					getProfile: async () => ({
						balance: 10,
						level: 3,
						tier: 'Gold',
						profile_view: 'trophy_shelf',
					}),
				},
				achievements,
				emoji,
			},
			subject,
		)
		expect(loaded?.preference).toBe('trophy_shelf')
		expect(loaded?.model).toMatchObject({
			balance: 10,
			level: 3,
			tier: 'Gold',
			stats: { wins: 5, losses: 3, pushes: 1, netProfit: 42.5 },
		})
		expect(loaded?.model.achievements?.earned[0].awardedAt).toBe(
			'2026-10-01T12:00:00.000Z',
		)
	})

	it('leaves the preference undefined when Khronos sends none', async () => {
		const loaded = await loadProfileViewData(
			{
				accounts: {
					getProfile: async () => ({
						balance: 10,
						level: 3,
						tier: 'Gold',
					}),
				},
				achievements,
				emoji,
			},
			subject,
		)
		expect(loaded?.preference).toBeUndefined()
	})

	it('still renders when only achievements loaded', async () => {
		const loaded = await loadProfileViewData(
			{
				accounts: {
					getProfile: async () => {
						throw new Error('down')
					},
				},
				achievements,
				emoji,
			},
			subject,
		)
		expect(loaded?.model.balance).toBeNull()
		expect(loaded?.model.achievements?.total).toBe(1)
	})

	it('returns null when nothing loaded', async () => {
		const down = async () => {
			throw new Error('down')
		}
		expect(
			await loadProfileViewData(
				{
					accounts: { getProfile: down },
					achievements: {
						evaluateUserAchievements: down,
						getUserAchievements: down,
					},
					emoji,
				},
				subject,
			),
		).toBeNull()
	})
})
