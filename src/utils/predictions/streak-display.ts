export type StreakBadgeTier = 3 | 5 | 10 | null

/** Format a compact, text-accessible badge marker for leaderboard rows. */
export function formatBadge(tier: StreakBadgeTier): string {
	return tier === null ? '' : ` 🔥${tier}`
}

/** Format the personal streak summary used by prediction stats embeds. */
export function formatStreakLine(current: number, best: number): string {
	const currentCopy =
		current > 0 ? `**${current}**` : '**0** (No active streak)'
	return `Current Streak: ${currentCopy} · Best: **${best}**`
}
