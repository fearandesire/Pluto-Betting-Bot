import { describe, expect, it, vi } from 'vitest'
import type { UserAchievementsDto } from '../../api/Khronos/achievements/achievements-wrapper.js'
import { loadProfileCardData } from '../load-profile-card-data.js'
import { fullCard } from './fixtures.js'

vi.mock('../../logging/WinstonLogger.js', () => ({
	logger: { warn: vi.fn() },
}))

const dto: UserAchievementsDto = {
	user_id: 'fixture-only',
	earned: Array.from({ length: 7 }, (_, index) => ({
		key: index === 0 ? 'parlay_pro' : `future-${index}`,
		name: `Authoritative name ${index}`,
		description: `Authoritative criterion ${index}`,
		awarded_at: `2026-11-0${7 - index}T00:00:00Z`,
	})),
	locked: [
		{
			key: 'first_win',
			name: 'First Win',
			description: 'Win a head-to-head bet.',
			progress: 0,
			target: 1,
		},
	],
	summary: fullCard.summary,
}

describe('profile data for artwork', () => {
	it('carries keys and descriptions in API order, caps recent art, and never invents an award', async () => {
		const evaluate = vi.fn().mockResolvedValue(dto)
		const get = vi.fn()
		const data = await loadProfileCardData(
			{
				accounts: {
					getProfile: async () => ({ tier: 'Gold', level: 38 }),
				},
				achievements: {
					evaluateUserAchievements: evaluate,
					getUserAchievements: get,
				},
			},
			'fixture-only',
			'Test Player',
		)
		expect(data?.badges).toEqual(
			dto.earned.slice(0, 5).map(({ key, name, description }) => ({
				key,
				name,
				description,
			})),
		)
		expect(data?.earnedCount).toBe(7)
		expect(data?.summary).toBe(dto.summary)
		expect(get).not.toHaveBeenCalled()
	})

	it('retains the read fallback and distinguishes service failure from an empty record', async () => {
		const failed = async () => {
			throw new Error('unavailable')
		}
		const accounts = {
			getProfile: async () => ({ tier: 'Gold', level: 38 }),
		}
		const read = vi.fn().mockResolvedValue(dto)
		const fallback = await loadProfileCardData(
			{
				accounts,
				achievements: {
					evaluateUserAchievements: failed,
					getUserAchievements: read,
				},
			},
			'fixture-only',
			'Test Player',
		)
		expect(read).toHaveBeenCalledWith('fixture-only')
		expect(fallback?.badges[0].key).toBe('parlay_pro')
		const missing = await loadProfileCardData(
			{
				accounts,
				achievements: {
					evaluateUserAchievements: failed,
					getUserAchievements: failed,
				},
			},
			'fixture-only',
			'Test Player',
		)
		expect(missing?.summary).toBeNull()
		expect(missing?.badges).toEqual([])
		expect(missing?.earnedCount).toBeUndefined()
	})
})
