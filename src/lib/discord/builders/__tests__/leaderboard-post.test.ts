import { MessageFlags } from 'discord.js'
import { describe, expect, it } from 'vitest'
import type { LeaderboardEntryWithStreaks } from '../../../../utils/api/Khronos/leaderboard/leaderboard-wrapper.js'
import {
	expectV2Payload,
	sumTextDisplayChars,
	toJsonComponents,
} from '../../v2/__tests__/v2-assert.js'
import { assertV2Budget } from '../../v2/kit.js'
import { leaderboardAutoPostPayload } from '../leaderboard-post.js'

const entry = (
	index: number,
	overrides: Partial<LeaderboardEntryWithStreaks> = {},
): LeaderboardEntryWithStreaks => ({
	user_id: `10000000000000000${index}`,
	total_predictions: 12,
	correct_predictions: 9,
	incorrect_predictions: 3,
	success_rate: 75,
	current_streak: 0,
	best_streak: 4,
	badge_tier: null,
	...overrides,
})

const contents = (payload: ReturnType<typeof leaderboardAutoPostPayload>) => {
	const [container] = toJsonComponents(payload) as Array<{
		components: Array<{ content?: string }>
	}>
	return container.components.map((c) => c.content ?? '')
}

describe('leaderboardAutoPostPayload', () => {
	it('renders a titled, ranked V2 message with mentions off', () => {
		const payload = leaderboardAutoPostPayload(
			[entry(1), entry(2, { correct_predictions: 5 })],
			'week',
		)

		// container + title + rows + footer
		expectV2Payload(payload, {
			flags: MessageFlags.IsComponentsV2,
			components: 4,
		})
		expect(payload.allowedMentions).toEqual({ parse: [] })
		const [title, rows] = contents(payload)
		expect(title).toBe('### 🏆 Weekly props leaderboard')
		expect(rows.split('\n')[0]).toContain('1. <@100000000000000001>')
	})

	it('labels the monthly board', () => {
		const [title] = contents(
			leaderboardAutoPostPayload([entry(1)], 'month'),
		)
		expect(title).toBe('### 🏆 Monthly props leaderboard')
	})

	it('caps a worst-case board at ten rows inside Discord limits', () => {
		const entries = Array.from({ length: 40 }, (_, index) =>
			entry(index, {
				correct_predictions: 99_999,
				incorrect_predictions: 99_999,
				current_streak: 99,
				badge_tier: 10,
			}),
		)
		const payload = leaderboardAutoPostPayload(entries, 'month')

		expectV2Payload(payload, {
			flags: MessageFlags.IsComponentsV2,
			components: 4,
		})
		expect(() => assertV2Budget(payload)).not.toThrow()
		expect(sumTextDisplayChars(toJsonComponents(payload))).toBeLessThan(
			4000,
		)
		expect(contents(payload)[1].split('\n')).toHaveLength(10)
	})
})
