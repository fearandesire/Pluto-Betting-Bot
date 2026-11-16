import type {
	RecapSport,
	WeeklyRecapResponse,
} from '../../../utils/api/Khronos/recap/recap-wrapper.js'
import { formatRecapUser } from '../../../utils/embeds/weekly-recap.embed.js'
import { accent, divider, footer, text, v2Payload } from '../v2/kit.js'

const MAX_PREDICTORS = 5

function formatPayout(payout: number): string {
	return Number.isFinite(payout) ? payout.toFixed(2) : '0.00'
}

function formatDelta(delta: number): string {
	if (!Number.isFinite(delta) || delta === 0) return '0.0 pp'
	return `${delta > 0 ? '+' : ''}${delta.toFixed(1)} pp`
}

function formatDateRange(data: WeeklyRecapResponse, sport: RecapSport): string {
	const start = new Date(data.window.start_date)
	const end = new Date(data.window.end_date)
	if (Number.isNaN(start.valueOf()) || Number.isNaN(end.valueOf())) {
		return sport === 'nfl'
			? 'Sleeper-aligned weekly window'
			: 'Weekly window'
	}
	return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })} – ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}`
}

function predictorLines(data: WeeklyRecapResponse): string {
	const predictors = data.top_predictors.slice(0, MAX_PREDICTORS)
	if (predictors.length === 0) return 'No predictors recorded this week.'
	return predictors
		.map((predictor, index) => {
			const total =
				predictor.correct_predictions + predictor.incorrect_predictions
			const rate = Number.isFinite(predictor.success_rate)
				? predictor.success_rate
				: total > 0
					? (predictor.correct_predictions / total) * 100
					: 0
			return `${index + 1}. ${formatRecapUser(predictor.user_id, predictor.display_name)} — **${predictor.correct_predictions}/${total}** (${rate.toFixed(1)}%)`
		})
		.join('\n')
}

function highlightLines(data: WeeklyRecapResponse): string {
	const lines: string[] = []
	if (data.biggest_single_win) {
		lines.push(
			`🎯 Single: ${formatRecapUser(data.biggest_single_win.user_id)} — **${formatPayout(data.biggest_single_win.payout)}**`,
		)
	}
	if (data.biggest_parlay_win) {
		lines.push(
			`🎲 Parlay: ${formatRecapUser(data.biggest_parlay_win.user_id)} — **${formatPayout(data.biggest_parlay_win.payout)}**`,
		)
	}
	return lines.length > 0
		? lines.join('\n')
		: 'No wins recorded this week — next week is yours.'
}

/** Components V2 weekly digest used by staff-triggered posts. */
export function weeklyRecapPayload(
	data: WeeklyRecapResponse,
	sport: RecapSport = 'nfl',
) {
	const sportPrefix = sport === 'nfl' ? '' : `${sport.toUpperCase()} `
	const weekLabel = data.window.week_number
		? `Week ${data.window.week_number}`
		: 'Weekly Recap'
	const accuracy = Number.isFinite(data.accuracy) ? data.accuracy : 0
	const season = data.window.season_year
		? ` · Season ${data.window.season_year}`
		: ''

	return v2Payload({
		accent: accent('PlutoBlue'),
		blocks: [
			text(`### 📊 ${sportPrefix}${weekLabel} Recap`),
			text(
				`${sport === 'nfl' ? 'Sleeper-aligned window' : 'Weekly window'}: **${formatDateRange(data, sport)}**${season}`,
			),
			divider(),
			text(`**Top predictors**\n${predictorLines(data)}`),
			divider(),
			text(`**Highlights**\n${highlightLines(data)}`),
			divider(),
			text(
				`**Totals**\nPredictions: **${data.total_predictions}**\nCorrect: **${data.correct_predictions}** · Incorrect: **${data.incorrect_predictions}**\nAccuracy: **${accuracy.toFixed(1)}%** (${formatDelta(data.accuracy_delta)})`,
			),
			footer('Khronos weekly recap · Pluto'),
		],
	})
}
