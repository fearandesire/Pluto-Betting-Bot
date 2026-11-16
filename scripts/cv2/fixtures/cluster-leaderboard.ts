import { leaderboardAutoPostPayload } from '../../../src/lib/discord/builders/leaderboard-post.js'
import type { LeaderboardEntryWithStreaks } from '../../../src/utils/api/Khronos/leaderboard/leaderboard-wrapper.js'
import type { ClusterFixtures } from './types.js'

const entry = (
	index: number,
	correct: number,
	incorrect: number,
	streak: number,
	tier: LeaderboardEntryWithStreaks['badge_tier'],
): LeaderboardEntryWithStreaks => ({
	user_id: `10000000000000000${index}`,
	total_predictions: correct + incorrect,
	correct_predictions: correct,
	incorrect_predictions: incorrect,
	success_rate: Math.round((correct / (correct + incorrect)) * 100),
	current_streak: streak,
	best_streak: streak,
	badge_tier: tier,
})

const withoutFiles = <T extends { files?: unknown }>({
	files,
	...message
}: T): Omit<T, 'files'> => message

const fixtures: ClusterFixtures = {
	cluster: 'leaderboard',
	surfaces: [
		{
			id: 'L1',
			name: 'Weekly props leaderboard auto-post',
			after: () =>
				withoutFiles(
					leaderboardAutoPostPayload(
						[
							entry(1, 14, 3, 10, 10),
							entry(2, 11, 4, 5, 5),
							entry(3, 9, 3, 3, 3),
							entry(4, 7, 5, 0, null),
						],
						'week',
					),
				),
		},
		{
			id: 'L2',
			name: 'Monthly props leaderboard auto-post (ten rows)',
			after: () =>
				withoutFiles(
					leaderboardAutoPostPayload(
						Array.from({ length: 12 }, (_, i) =>
							entry(
								i,
								60 - i * 3,
								10 + i,
								i === 0 ? 10 : 0,
								i === 0 ? 10 : null,
							),
						),
						'month',
					),
				),
		},
	],
}

export default fixtures
