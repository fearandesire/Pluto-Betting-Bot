import type { LeaderboardEntryWithStreaks } from '../../../utils/api/Khronos/leaderboard/leaderboard-wrapper.js'
import { accent, footer, text, v2Payload } from '../v2/kit.js'
import { formatStreakBadge, leaderboardScore } from './props.js'

const MAX_ROWS = 10

/**
 * Compact weekly/monthly props leaderboard for the automatic recap-channel
 * posts. The paged `/predictions leaderboard` embed stays untouched.
 */
export function leaderboardAutoPostPayload(
	entries: LeaderboardEntryWithStreaks[],
	period: 'week' | 'month',
) {
	const rows = entries.slice(0, MAX_ROWS).map((entry, index) => {
		const total = entry.correct_predictions + entry.incorrect_predictions
		const badge = formatStreakBadge(entry.current_streak, entry.badge_tier)
		const score = leaderboardScore(
			entry.correct_predictions,
			entry.incorrect_predictions,
		)
		return `${index + 1}. <@${entry.user_id}> — **${score} pts** (${entry.correct_predictions}/${total})${badge}`
	})
	const label = period === 'week' ? 'Weekly' : 'Monthly'

	return v2Payload({
		accent: accent('PlutoBlue'),
		blocks: [
			text(`### 🏆 ${label} props leaderboard`),
			text(rows.join('\n')),
			footer('Top 10 · Khronos prediction leaderboard · Pluto'),
		],
	})
}
