import { describe, expect, it } from 'vitest'
import {
	COLLAPSED_ACHIEVEMENT_LIMIT,
	collapsedAchievementCount,
	DEFAULT_PROFILE_VIEW,
	isProfileView,
	selectProfileView,
	shelfPageCount,
} from '../profile-view.js'

describe('selectProfileView', () => {
	it("keeps today's PNG card while the flag is off, whatever is saved", () => {
		expect(
			selectProfileView({ enabled: false, preference: 'trophy_shelf' }),
		).toBe('classic')
		expect(selectProfileView({ enabled: false, preference: null })).toBe(
			'classic',
		)
	})

	it('defaults to Headline', () => {
		expect(DEFAULT_PROFILE_VIEW).toBe('headline')
	})

	it.each([undefined, null, '', 'ledger', 'Headline', 7, {}])(
		'reads an unset or unknown preference (%j) as Headline',
		(preference) => {
			expect(selectProfileView({ enabled: true, preference })).toBe(
				'headline',
			)
		},
	)

	it('honours a saved choice', () => {
		expect(
			selectProfileView({ enabled: true, preference: 'headline' }),
		).toBe('headline')
		expect(
			selectProfileView({ enabled: true, preference: 'trophy_shelf' }),
		).toBe('trophy_shelf')
	})

	it('knows only the two views', () => {
		expect(isProfileView('trophy_shelf')).toBe(true)
		expect(isProfileView('classic')).toBe(false)
	})
})

describe('collapsed achievement count', () => {
	it.each([
		[0, 0],
		[1, 1],
		[3, 3],
		[4, COLLAPSED_ACHIEVEMENT_LIMIT],
		[30, COLLAPSED_ACHIEVEMENT_LIMIT],
		[-2, 0],
	])('%i earned lists %i', (earned, shown) => {
		expect(collapsedAchievementCount(earned)).toBe(shown)
	})

	it('pages the shelf five at a time and never reports zero pages', () => {
		expect(shelfPageCount(0)).toBe(1)
		expect(shelfPageCount(5)).toBe(1)
		expect(shelfPageCount(6)).toBe(2)
		expect(shelfPageCount(10)).toBe(2)
	})
})
