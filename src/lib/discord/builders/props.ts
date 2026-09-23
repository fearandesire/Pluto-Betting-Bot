import {
	type AllUserPredictionsDto,
	GetAllPredictionsFilteredStatusEnum,
	type ProcessedPropDto,
} from '@pluto-khronos/api-client'
import { PaginatedMessageEmbedFields } from '@sapphire/discord.js-utilities'
import { format } from 'date-fns'
import {
	ActionRowBuilder,
	type APIEmbed,
	ButtonBuilder,
	ButtonStyle,
	type Embed,
	EmbedBuilder,
} from 'discord.js'
import _ from 'lodash'
import { MarketKeyTranslations } from '../../../utils/api/common/interfaces/market-translations.js'
import type { PropSettledNotification } from '../../../utils/api/routes/shared-payload-schemas.js'
import StringUtils from '../../../utils/common/string-utils.js'
import {
	formatBadge,
	formatStreakLine,
	type StreakBadgeTier,
} from '../../../utils/predictions/streak-display.js'
import embedColors from '../../colorsConfig.js'
import { LEADERBOARD_SCORING } from '../../scoring-constants.js'

// ---------------------------------------------------------------- C1 prop post

/** Team data the prop post needs; resolved by the caller (TeamInfo). */
export type PropPostTeams = {
	/** resolve-team `abbrev` (a one-item array, interpolated as-is). */
	homeAbbrev: string | string[]
	awayAbbrev: string | string[]
	/** Home team colour as an integer. */
	homeColor: number
}

/** Prop post embed (surface C1). */
export function propPostEmbed(
	prop: ProcessedPropDto,
	sport: 'nfl' | 'nba',
	teams: PropPostTeams,
): EmbedBuilder {
	const sportEmoji = sport === 'nfl' ? '🏈' : '🏀'
	const marketTranslation =
		MarketKeyTranslations[prop.market_key] || prop.market_key
	const marketName = StringUtils.toTitleCase(marketTranslation)

	const gameTime = format(new Date(prop.commence_time), 'EEE, h:mm a')

	const title = '🎯 Accuracy Challenge'

	const descriptionLines = [
		`### **${prop.description}** • O/U **\`${prop.point}\`** ${marketName}\n`,
		`**Market:** ${marketName}`,
		`**Over**: ${prop.over.price > 0 ? '+' : ''}${prop.over.price}\n**Under**: ${prop.under.price > 0 ? '+' : ''}${prop.under.price}`,
	]

	return new EmbedBuilder()
		.setTitle(title)
		.setDescription(descriptionLines.join('\n'))
		.addFields(
			{
				name: 'Match',
				value: `${sportEmoji} ${teams.homeAbbrev} vs. ${teams.awayAbbrev}`,
				inline: true,
			},
			{
				name: 'Game Time',
				value: `⏰ ${gameTime}`,
				inline: true,
			},
		)
		.setColor(teams.homeColor)
		.setTimestamp()
}

/** Over/Under buttons (surface C1). Custom IDs are `prop_<outcome_uuid>`. */
export function propPostButtons(
	prop: ProcessedPropDto,
): ActionRowBuilder<ButtonBuilder> {
	const overButton = new ButtonBuilder()
		.setCustomId(`prop_${prop.over.outcome_uuid}`)
		.setLabel('Over')
		.setEmoji('⬆️')
		.setStyle(ButtonStyle.Success)

	const underButton = new ButtonBuilder()
		.setCustomId(`prop_${prop.under.outcome_uuid}`)
		.setLabel('Under')
		.setEmoji('⬇️')
		.setStyle(ButtonStyle.Danger)

	return new ActionRowBuilder<ButtonBuilder>().addComponents(
		overButton,
		underButton,
	)
}

// ---------------------------------------------------------- C2 settlement edit

/**
 * Settled prop post (surface C2): the original C1 embed with the result and
 * tally fields appended, or replaced in place on a repeat settlement.
 */
export function propSettlementEmbed(
	originalEmbed: Embed | APIEmbed,
	data: PropSettledNotification,
): EmbedBuilder {
	const embed = EmbedBuilder.from(originalEmbed)
	const fields = [...(embed.data.fields ?? [])]
	const resultFieldName = '🎯 Result'
	const tallyFieldName = '📊 Prediction results'
	const resultField = {
		name: resultFieldName,
		value: formatPropResult(data),
		inline: false,
	}
	const tallyField = {
		name: tallyFieldName,
		value: formatPropTallies(data),
		inline: false,
	}

	const resultIndex = fields.findIndex(
		(field) => field.name === resultFieldName,
	)
	if (resultIndex === -1) fields.push(resultField)
	else fields[resultIndex] = resultField

	const tallyIndex = fields.findIndex(
		(field) => field.name === tallyFieldName,
	)
	if (tallyIndex === -1) fields.push(tallyField)
	else fields[tallyIndex] = tallyField

	return embed.setFields(fields)
}

function formatPropResult(data: PropSettledNotification): string {
	const iconByResult: Record<PropSettledNotification['result'], string> = {
		won: '✅',
		lost: '❌',
		push: '➖',
		void: '🚫',
	}
	const label =
		data.winning_side_display?.trim() ||
		(
			{
				won: 'Won',
				lost: 'Lost',
				push: 'Push',
				void: 'Voided',
			} satisfies Record<PropSettledNotification['result'], string>
		)[data.result]
	const actualValue =
		data.actual_value === null || data.actual_value === undefined
			? ''
			: ` — ${data.actual_value}`

	return `**Result: ${label} ${iconByResult[data.result]}${actualValue}**`
}

function formatPropTallies(data: PropSettledNotification): string {
	const { correct, incorrect, total } = data.tallies
	const percentage = total === 0 ? 0 : Math.round((correct / total) * 100)
	const predictorLabel = total === 1 ? 'predictor' : 'predictors'
	return `${percentage}% of ${total} ${predictorLabel} got it right (${correct} correct, ${incorrect} incorrect).`
}

// ---------------------------------------------------- C5 /predictions history

/** Message template for the history paginator (surface C5). */
export function predictionHistoryTemplate(
	username: string,
	status: string | null,
): EmbedBuilder {
	const description = status ? `Filtered by: \`${status}\`` : undefined
	const templateEmbed = new EmbedBuilder()
		.setTitle(`Prediction History | ${username}`)
		.setColor(embedColors.PlutoBlue)
	if (description) templateEmbed.setDescription(description)
	return templateEmbed
}

/** One prediction as a paginator field (surface C5). */
export function predictionHistoryField(args: {
	prediction: AllUserPredictionsDto
	/** `Away vs. Home`, emojis already resolved by the caller. */
	matchLabel: string
	/** MM/DD/YYYY of the event. */
	date: string
	point: number | null
	marketKey: string
}): { name: string; value: string; inline: boolean } {
	const { prediction, point } = args
	const choice =
		prediction.choice.charAt(0).toUpperCase() +
		prediction.choice.slice(1).toLowerCase()
	const status =
		prediction.status !== GetAllPredictionsFilteredStatusEnum.Completed
			? 'Pending ⏳'
			: prediction.is_correct === true
				? 'Correct ✅'
				: prediction.is_correct === false
					? 'Incorrect ❌'
					: 'Pending ⏳'
	const market = _.startCase(args.marketKey.replace('player_', ''))
	const value = [
		`**Date**: ${args.date}`,
		`**Status**: ${status}`,
		`**Choice**: \`${choice}${point === null ? '' : ` ${point}`}\``,
		`**Market**: ${market}`,
		prediction.description?.trim()
			? `**Player:** ${prediction.description}`
			: null,
	]
		.filter((line): line is string => Boolean(line))
		.join('\n')

	return { name: args.matchLabel, value, inline: false }
}

/** Sapphire paginator for /predictions history, 10 fields per page (C5). */
export function predictionHistoryPaginator(
	templateEmbed: EmbedBuilder,
	fields: { name: string; value: string; inline: boolean }[],
) {
	return new PaginatedMessageEmbedFields({
		template: { embeds: [templateEmbed] },
	})
		.setItems(fields)
		.setItemsPerPage(10)
		.make()
}

// ------------------------------------------------------ C6 /predictions stats

/** Personal prediction stats (surface C6). */
export function predictionStatsEmbed(args: {
	username: string
	totalPredictions: number
	correctPredictions: number
	incorrectPredictions: number
	winRate: number
	pendingCount: number
	currentStreak: number | null
	bestStreak: number | null
	/** False when the stats endpoint failed (streak fields show Unavailable). */
	statsAvailable: boolean
	badgeTier: StreakBadgeTier
}): EmbedBuilder {
	const { currentStreak, bestStreak, badgeTier } = args
	return new EmbedBuilder()
		.setTitle('📊 Prediction Statistics')
		.setColor(embedColors.PlutoBlue)
		.setDescription(
			`Server stats for ${args.username}\n\n${formatStreakLine(currentStreak, bestStreak)}`,
		)
		.addFields(
			{
				name: 'Total Predictions',
				value: `\`${args.totalPredictions}\``,
				inline: true,
			},
			{
				name: 'Win Rate',
				value: `\`${args.winRate.toFixed(1)}%\``,
				inline: true,
			},
			{ name: '​', value: '​', inline: true },
			{
				name: '✅ Correct',
				value: `\`${args.correctPredictions}\``,
				inline: true,
			},
			{
				name: '❌ Incorrect',
				value: `\`${args.incorrectPredictions}\``,
				inline: true,
			},
			{
				name: '⏳ Pending',
				value: `\`${args.pendingCount}\``,
				inline: true,
			},
			{
				name: '🔥 Current Streak',
				value:
					currentStreak === null
						? '`Unavailable`'
						: `\`${currentStreak}\``,
				inline: true,
			},
			{
				name: '🏆 Best Streak',
				value:
					bestStreak === null ? '`Unavailable`' : `\`${bestStreak}\``,
				inline: true,
			},
			{
				name: '🏅 Streak Badge',
				value: !args.statsAvailable
					? '`Unavailable`'
					: badgeTier === null
						? '`None yet`'
						: `\`🔥${badgeTier}\``,
				inline: true,
			},
		)
		.setFooter({
			text: "Use /predictions leaderboard to compare your streak • voids/pushes don't break streaks.",
		})
		.setTimestamp()
}

// ------------------------------------------------ C7 /predictions leaderboard

/** Resolve display badge from the current streak when older API payloads omit it. */
export function resolveStreakBadgeTier(
	currentStreak: number | null,
	reportedTier: StreakBadgeTier = null,
): StreakBadgeTier {
	if (currentStreak === null) return null
	if (reportedTier !== null) return reportedTier
	if (currentStreak >= 10) return 10
	if (currentStreak >= 5) return 5
	if (currentStreak >= 3) return 3
	return null
}

/** Keep leaderboard marker copy consistent across pages and future clients. */
export function formatStreakBadge(
	currentStreak: number,
	reportedTier: StreakBadgeTier = null,
): string {
	const tier = resolveStreakBadgeTier(currentStreak, reportedTier)
	return formatBadge(tier)
}

export function leaderboardScore(correct: number, incorrect: number): number {
	return (
		correct * LEADERBOARD_SCORING.CORRECT_POINTS +
		incorrect * LEADERBOARD_SCORING.INCORRECT_PENALTY
	)
}

export type LeaderboardRow = {
	position: number
	/** Resolved member username, or the user ID when unresolved. */
	username: string
	score: number
	correctPredictions: number
	incorrectPredictions: number
	currentStreak: number
	badgeTier: StreakBadgeTier
}

/** One leaderboard page, 20 rows per page (surface C7). */
export function predictionLeaderboardEmbed(
	pageRows: LeaderboardRow[],
	currentPage: number,
	totalEntries: number,
): EmbedBuilder {
	const totalPages = Math.ceil(totalEntries / 20)
	const description = pageRows.map((entry) => {
		const total = entry.correctPredictions + entry.incorrectPredictions
		const streakBadge = formatStreakBadge(
			entry.currentStreak,
			entry.badgeTier,
		)
		return `${entry.position}. ${entry.username}${streakBadge} - **\`${entry.score}\`** *(${entry.correctPredictions}/${total})*`
	})

	return new EmbedBuilder()
		.setTitle('Prediction Accuracy Leaderboard')
		.setColor(embedColors.PlutoBlue)
		.setDescription(description.join('\n'))
		.setFooter({
			text: `Page ${currentPage} of ${totalPages} | Total Entries: ${totalEntries} | 🔥3/5/10 = streak badge`,
		})
}

// ------------------------------------------------- C8 deprecated alias notice

/** Notice shown by the legacy prediction aliases (surface C8). */
export function predictionDeprecationEmbed(replacement: string): EmbedBuilder {
	return new EmbedBuilder()
		.setColor(embedColors.info)
		.setTitle('Prediction command moved')
		.setDescription(
			`This command is kept for one release as an alias. Use **${replacement}** instead.`,
		)
		.setFooter({
			text: 'Legacy aliases will be removed after the migration window.',
		})
}
