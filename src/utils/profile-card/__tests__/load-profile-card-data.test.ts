import { describe, expect, it, vi } from 'vitest'

vi.mock('../../logging/WinstonLogger.js', () => ({
	logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

const { loadProfileCardData } = await import('../load-profile-card-data.js')
const { buildBadgeEmojiRegistry } = await import(
	'../../../lib/badges/badge-emoji-registry.js'
)

const summary = {
	settled_bets: 0,
	wins: 0,
	losses: 0,
	pushes: 0,
	net_profit: 0,
	best_win_payout: null,
	settled_predictions: 0,
	prediction_hit_rate: null,
}
const dto = {
	user_id: 'u',
	earned: [
		{
			key: 'first_win',
			name: 'First Win',
			description: '',
			awarded_at: 'x',
		},
		{
			key: 'sharp_eye',
			name: 'Sharp Eye',
			description: '',
			awarded_at: 'x',
		},
	],
	locked: [
		{
			key: 'ten_wins',
			name: 'Ten Wins',
			description: '',
			progress: 1,
			target: 10,
		},
	],
	summary,
}
const accounts = { getProfile: async () => ({ level: 3, tier: 'Bronze' }) }

describe('loadProfileCardData', () => {
	it('passes approved labels to the card', async () => {
		const loaded = await loadProfileCardData(
			{
				accounts,
				achievements: {
					evaluateUserAchievements: async () => dto,
					getUserAchievements: async () => dto,
				},
				emoji: buildBadgeEmojiRegistry([]),
			},
			'u',
			'Harbor',
		)
		expect(loaded?.card.badges).toEqual([
			'Opening Score',
			'The Line Reader',
		])
		expect(loaded?.card.earnedCount).toBe(2)
		expect(loaded?.badgeLine).toBe(
			'Opening Score · The Line Reader · 2 of 3 badges',
		)
	})

	it('omits the badge line when achievements cannot be loaded', async () => {
		const down = async () => {
			throw new Error('down')
		}
		const loaded = await loadProfileCardData(
			{
				accounts,
				achievements: {
					evaluateUserAchievements: down,
					getUserAchievements: down,
				},
			},
			'u',
			'Harbor',
		)
		expect(loaded?.badgeLine).toBeNull()
		expect(loaded?.card.badges).toEqual([])
	})
})
