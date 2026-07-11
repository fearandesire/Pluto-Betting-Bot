import { EmbedBuilder } from 'discord.js'
import embedColors from '../../lib/colorsConfig.js'
import type { WeeklyRecapResponse } from '../api/Khronos/recap/recap-wrapper.js'

const MAX_PREDICTORS = 5
const MAX_DISPLAY_NAME_LENGTH = 32

export type WeeklyRecapEmbedData = WeeklyRecapResponse

/**
 * Truncate user-provided display names before inserting them into Discord
 * embed text. IDs remain available as a mention fallback when no name exists.
 */
export function formatRecapUser(userId: string, displayName?: string): string {
	const candidate = displayName?.trim() || `<@${userId}>`
	if (candidate.length <= MAX_DISPLAY_NAME_LENGTH) return candidate
	return `${candidate.slice(0, MAX_DISPLAY_NAME_LENGTH - 1)}…`
}

function formatPayout(payout: number): string {
	return Number.isFinite(payout) ? payout.toFixed(2) : '0.00'
}

function formatDelta(delta: number): string {
	if (!Number.isFinite(delta) || delta === 0) return '0.0 pp'
	return `${delta > 0 ? '+' : ''}${delta.toFixed(1)} pp`
}

function formatDateRange(data: WeeklyRecapEmbedData): string {
	const start = new Date(data.window.start_date)
	const end = new Date(data.window.end_date)
	if (Number.isNaN(start.valueOf()) || Number.isNaN(end.valueOf())) {
		return 'Sleeper-aligned weekly window'
	}

	return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })} – ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}`
}

function buildPredictorLines(data: WeeklyRecapEmbedData): string {
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

function buildWinLines(data: WeeklyRecapEmbedData): string {
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

/**
 * Build the weekly digest embeds posted by the recap cron.
 *
 * The digest intentionally caps predictor rows at five and keeps each section
 * in a single field, staying below Discord's field and message limits while
 * preserving the complete aggregate totals from Khronos.
 */
export function buildWeeklyRecapEmbeds(
	data: WeeklyRecapEmbedData,
): EmbedBuilder[] {
	const weekLabel = data.window.week_number
		? `Week ${data.window.week_number}`
		: 'Weekly Recap'
	const accuracy = Number.isFinite(data.accuracy) ? data.accuracy : 0

	const embed = new EmbedBuilder()
		.setTitle(`📊 ${weekLabel} Recap`)
		.setColor(embedColors.PlutoBlue)
		.setDescription(
			`Sleeper-aligned window: **${formatDateRange(data)}**${data.window.season_year ? ` · Season ${data.window.season_year}` : ''}`,
		)
		.addFields(
			{
				name: 'Top predictors',
				value: buildPredictorLines(data),
			},
			{
				name: 'Highlights',
				value: buildWinLines(data),
			},
			{
				name: 'Totals',
				value: [
					`Predictions: **${data.total_predictions}**`,
					`Correct: **${data.correct_predictions}** · Incorrect: **${data.incorrect_predictions}**`,
					`Accuracy: **${accuracy.toFixed(1)}%** (${formatDelta(data.accuracy_delta)})`,
				].join('\n'),
			},
		)
		.setFooter({ text: 'Khronos weekly recap · Pluto' })

	return [embed]
}
