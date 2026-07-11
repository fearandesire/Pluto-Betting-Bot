export type StreakBadgeTier = 3 | 5 | 10 | null

/** Format a compact, text-accessible badge marker for leaderboard rows. */
export function formatBadge(tier: StreakBadgeTier): string {
	return tier === null ? '' : ` 🔥${tier}`
}

/** Format the personal streak summary used by prediction stats embeds. */
export function formatStreakLine(
	current: number | null,
	best: number | null,
): string {
	if (current === null || best === null) {
		return 'Current Streak: **Unavailable** · Best: **Unavailable**'
	}

	const currentCopy =
		current > 0 ? `**${current}**` : '**0** (No active streak)'
	return `Current Streak: ${currentCopy} · Best: **${best}**`
}
