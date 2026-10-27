import type {
	PeriodWinner,
	PeriodWinnersResponse,
} from '../../../utils/api/Khronos/recap/recap-wrapper.js'
import { accent, divider, footer, text, v2Payload } from '../v2/kit.js'

const MAX_LEADERBOARD_ROWS = 5
const MAX_WINNERS = 5

const PERIOD_LABELS = {
	weekly: 'Weekly',
	monthly: 'Monthly',
	season: 'Season',
} as const

function formatProfit(netProfit: number): string {
	if (!Number.isFinite(netProfit)) return '0.00'
	return `${netProfit > 0 ? '+' : ''}${netProfit.toFixed(2)}`
}

/** Khronos reports ROI as a percentage, like the recap's accuracy; null when nothing was staked. */
function formatRoi(roi: number | null): string {
	return roi !== null && Number.isFinite(roi)
		? `ROI ${roi.toFixed(1)}%`
		: 'ROI n/a'
}

function formatRow(entry: PeriodWinner, prefix = ''): string {
	return `${prefix}<@${entry.user_id}> — **${formatProfit(entry.net_profit)}** · ${formatRoi(entry.roi)} · ${entry.settled_bets} bets`
}

/**
 * Components V2 post for a closed period's winners. Mentions render but never
 * ping (v2Payload sets allowedMentions to none).
 */
export function periodWinnersPayload(data: PeriodWinnersResponse) {
	const winners = data.winners.slice(0, MAX_WINNERS)
	const shareRank = winners.every(
		(winner) => winner.rank === winners[0]?.rank,
	)
	const heading =
		winners.length === 1
			? 'Winner'
			: shareRank
				? `Co-winners (tied at #${winners[0]?.rank ?? 1})`
				: 'Winners'

	const rows = data.leaderboard.slice(0, MAX_LEADERBOARD_ROWS)
	const unresolved =
		data.unresolved_events > 0
			? ` · ${data.unresolved_events} events still unresolved`
			: ''

	return v2Payload({
		accent: accent('PlutoYellow'),
		blocks: [
			text(
				`### 🏆 ${data.sport.toUpperCase()} ${PERIOD_LABELS[data.period]} winners · ${data.window.label}`,
			),
			text(
				`**${heading}**\n${winners
					.map((winner) =>
						formatRow(winner, shareRank ? '' : `${winner.rank}. `),
					)
					.join('\n')}`,
			),
			...(rows.length > 0
				? [
						divider(),
						text(
							`**Leaderboard**\n${rows
								.map((row) => formatRow(row, `${row.rank}. `))
								.join('\n')}`,
						),
					]
				: []),
			divider(),
			footer(
				`${data.participants} participants${unresolved} · Khronos period winners · Pluto`,
			),
		],
	})
}
