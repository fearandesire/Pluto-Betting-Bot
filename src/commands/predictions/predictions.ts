import type { AllUserPredictionsDto } from '@pluto-khronos/api-client'
import { GetAllPredictionsFilteredStatusEnum } from '@pluto-khronos/api-client'
import { ApplyOptions } from '@sapphire/decorators'
import { PaginatedMessageEmbedFields } from '@sapphire/discord.js-utilities'
import { Subcommand } from '@sapphire/plugin-subcommands'
import {
	EmbedBuilder,
	InteractionContextType,
	type Message,
	PermissionFlagsBits,
} from 'discord.js'
import _ from 'lodash'
import { teamResolver } from 'resolve-team'
import embedColors from '../../lib/colorsConfig.js'
import { LEADERBOARD_SCORING } from '../../lib/scoring-constants.js'
import LeaderboardWrapper, {
	type LeaderboardResponseWithStreaks,
} from '../../utils/api/Khronos/leaderboard/leaderboard-wrapper.js'
import PredictionApiWrapper from '../../utils/api/Khronos/prediction/predictionApiWrapper.js'
import PropsApiWrapper from '../../utils/api/Khronos/props/props-api-wrapper.js'
import StatsWrapper, {
	type PredictionStats,
} from '../../utils/api/Khronos/stats/stats-wrapper.js'
import ClientTools from '../../utils/bot_res/ClientTools.js'
import { DateManager } from '../../utils/common/DateManager.js'
import TeamInfo from '../../utils/common/TeamInfo.js'
import Pagination from '../../utils/embeds/pagination.js'
import {
	formatBadge,
	formatStreakLine,
	type StreakBadgeTier,
} from '../../utils/predictions/streak-display.js'

/**
 * Reserved command id for the consolidated group. Legacy aliases retain their
 * existing hints for one release and are removed with the alias pieces after
 * the migration window.
 */
const PREDICTIONS_COMMAND_ID_HINTS = ['1298280482123026537']

/** Resolve display badge from the current streak when older API payloads omit it. */
export function resolveStreakBadgeTier(
	currentStreak: number,
	reportedTier: StreakBadgeTier = null,
): StreakBadgeTier {
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

@ApplyOptions<Subcommand.Options>({
	name: 'predictions',
	description: 'View prediction history, stats, and leaderboard',
	requiredClientPermissions: [
		PermissionFlagsBits.SendMessages,
		PermissionFlagsBits.EmbedLinks,
	],
	subcommands: [
		{ name: 'history', chatInputRun: 'handleHistory' },
		{ name: 'stats', chatInputRun: 'handleStats' },
		{ name: 'leaderboard', chatInputRun: 'handleLeaderboard' },
	],
})
export class UserCommand extends Subcommand {
	private readonly dateManager = new DateManager()

	public override registerApplicationCommands(registry: Subcommand.Registry) {
		registry.registerChatInputCommand(
			(builder) =>
				builder
					.setName(this.name)
					.setDescription(this.description)
					.setContexts(InteractionContextType.Guild)
					.addSubcommand((subcommand) =>
						subcommand
							.setName('history')
							.setDescription('View prediction history')
							.addUserOption((option) =>
								option
									.setName('user')
									.setDescription(
										'[Optional] The user to view history for (default: yourself)',
									)
									.setRequired(false),
							)
							.addStringOption((option) =>
								option
									.setName('status')
									.setDescription(
										'Filter predictions by status',
									)
									.setRequired(false)
									.addChoices(
										{
											name: 'Pending',
											value: GetAllPredictionsFilteredStatusEnum.Pending,
										},
										{
											name: 'Completed',
											value: GetAllPredictionsFilteredStatusEnum.Completed,
										},
									),
							),
					)
					.addSubcommand((subcommand) =>
						subcommand
							.setName('stats')
							.setDescription(
								'View server-calculated prediction statistics',
							),
					)
					.addSubcommand((subcommand) =>
						subcommand
							.setName('leaderboard')
							.setDescription(
								'View the prediction accuracy leaderboard',
							),
					),
			{ idHints: PREDICTIONS_COMMAND_ID_HINTS },
		)
	}

	public async handleHistory(
		interaction: Subcommand.ChatInputCommandInteraction,
	) {
		await interaction.deferReply({ ephemeral: true })

		const user = interaction.options.getUser('user') || interaction.user
		const status = interaction.options.getString(
			'status',
		) as GetAllPredictionsFilteredStatusEnum | null

		try {
			const predictionApiWrapper = new PredictionApiWrapper()
			const predictions = await (status
				? predictionApiWrapper.getPredictionsFiltered({
						userId: user.id,
						status,
					})
				: predictionApiWrapper.getPredictionsForUser({
						userId: user.id,
					}))

			if (!predictions || predictions.length === 0) {
				return interaction.editReply({
					content: 'No predictions found for the specified criteria.',
				})
			}

			const description = status
				? `Filtered by: \`${status}\``
				: undefined
			const templateEmbed = new EmbedBuilder()
				.setTitle(`Prediction History | ${user.username}`)
				.setColor(embedColors.PlutoBlue)
			if (description) templateEmbed.setDescription(description)

			const propsApiWrapper = new PropsApiWrapper()
			let hadFormattingFailures = false
			const formattedPredictions = (
				await Promise.allSettled(
					predictions.map((prediction) =>
						this.createPredictionField(prediction, propsApiWrapper),
					),
				)
			).flatMap((result, index) => {
				if (result.status === 'fulfilled') {
					return result.value ? [result.value] : []
				}
				hadFormattingFailures = true
				this.container.logger.error(
					`Failed to create prediction field for prediction ${predictions[index]?.id || 'unknown'} (user: ${user.id})`,
					result.reason,
				)
				return []
			})

			if (formattedPredictions.length === 0) {
				const message = hadFormattingFailures
					? 'We were unable to load details for your predictions. Please try again later.'
					: 'No prediction history found. Your predictions will appear here once you make them.'
				templateEmbed.setDescription(
					description ? `${description}\n\n${message}` : message,
				)
				return interaction.editReply({ embeds: [templateEmbed] })
			}

			const paginatedMessage = new PaginatedMessageEmbedFields({
				template: { embeds: [templateEmbed] },
			})
				.setItems(formattedPredictions)
				.setItemsPerPage(10)
				.make()

			return paginatedMessage.run(interaction)
		} catch (error) {
			this.container.logger.error(error)
			return interaction.editReply({
				content:
					'An error occurred while fetching the prediction history.',
			})
		}
	}

	public async handleStats(
		interaction: Subcommand.ChatInputCommandInteraction,
	) {
		await interaction.deferReply({ ephemeral: true })

		const guildId = interaction.guildId
		if (!guildId) {
			return interaction.editReply({
				content: 'This command can only be used in a guild.',
			})
		}

		try {
			const [leaderboard, allPending] = await Promise.all([
				new LeaderboardWrapper().getLeaderboard({ guildId }),
				new PredictionApiWrapper().getActivePredictionsForUser({
					userId: interaction.user.id,
				}),
			])
			let predictionStats: PredictionStats | null = null
			try {
				predictionStats = await new StatsWrapper().getPredictionStats({
					userId: interaction.user.id,
					guildId,
				})
			} catch (error) {
				// Keep stats usable while a mixed-version Khronos deployment rolls
				// out without presenting stale leaderboard streaks as personal stats.
				this.container.logger.warn(
					'Prediction streak stats unavailable; using leaderboard fallback.',
					error,
				)
			}
			const pending = allPending.filter(
				(prediction) => prediction.guild_id === guildId,
			)

			const entry = leaderboard.entries.find(
				(candidate) => candidate.user_id === interaction.user.id,
			)
			if (!entry && pending.length === 0) {
				return interaction.editReply({
					content: "You haven't made any predictions yet.",
				})
			}

			const totalPredictions = entry?.total_predictions ?? 0
			const correctPredictions = entry?.correct_predictions ?? 0
			const incorrectPredictions = entry?.incorrect_predictions ?? 0
			const winRate = entry?.success_rate ?? 0
			const currentStreak = predictionStats?.current_streak ?? 0
			const bestStreak = predictionStats?.best_streak ?? 0
			const badgeTier = resolveStreakBadgeTier(
				currentStreak,
				predictionStats?.badge_tier ?? null,
			)
			const embed = new EmbedBuilder()
				.setTitle('📊 Prediction Statistics')
				.setColor(embedColors.PlutoBlue)
				.setDescription(
					`Server stats for ${interaction.user.username}\n\n${formatStreakLine(currentStreak, bestStreak)}`,
				)
				.addFields(
					{
						name: 'Total Predictions',
						value: `\`${totalPredictions}\``,
						inline: true,
					},
					{
						name: 'Win Rate',
						value: `\`${winRate.toFixed(1)}%\``,
						inline: true,
					},
					{ name: '\u200B', value: '\u200B', inline: true },
					{
						name: '✅ Correct',
						value: `\`${correctPredictions}\``,
						inline: true,
					},
					{
						name: '❌ Incorrect',
						value: `\`${incorrectPredictions}\``,
						inline: true,
					},
					{
						name: '⏳ Pending',
						value: `\`${pending.length}\``,
						inline: true,
					},
					{
						name: '🔥 Current Streak',
						value: `\`${currentStreak}\``,
						inline: true,
					},
					{
						name: '🏆 Best Streak',
						value: `\`${bestStreak}\``,
						inline: true,
					},
					{
						name: '🏅 Streak Badge',
						value:
							badgeTier === null
								? '`None yet`'
								: `\`🔥${badgeTier}\``,
						inline: true,
					},
				)
				.setFooter({
					text: "Use /predictions leaderboard to compare your streak • voids/pushes don't break streaks.",
				})
				.setTimestamp()

			return interaction.editReply({ embeds: [embed] })
		} catch (error) {
			this.container.logger.error(error)
			return interaction.editReply({
				content: 'An error occurred while fetching your statistics.',
			})
		}
	}

	public async handleLeaderboard(
		interaction: Subcommand.ChatInputCommandInteraction,
	) {
		await interaction.deferReply()
		const guildId = interaction.guildId
		if (!guildId) {
			return interaction.editReply({
				content: 'This command can only be used in a guild.',
			})
		}

		try {
			const leaderboard = await new LeaderboardWrapper().getLeaderboard({
				guildId,
			})
			if (!leaderboard.entries.length) {
				return interaction.editReply({
					content: 'No leaderboard data found.',
				})
			}

			const parsed = this.parseLeaderboardData(leaderboard)
			const totalPages = Math.ceil(parsed.length / 20)
			const embed = await this.createLeaderboardEmbed(parsed, 1)
			const pagination = new Pagination()
			const reply = await interaction.editReply({
				content: null,
				embeds: [embed],
				components: pagination.createPaginationButtons(1, totalPages),
			})

			await this.handlePagination(interaction, reply, parsed)
		} catch (error) {
			this.container.logger.error(error)
			return interaction.editReply({
				content: 'An error occurred while fetching the leaderboard.',
			})
		}
	}

	private async createPredictionField(
		prediction: AllUserPredictionsDto,
		propsApiWrapper: PropsApiWrapper,
	): Promise<{ name: string; value: string; inline: boolean } | null> {
		const prop = await propsApiWrapper.getPropByUuid(
			prediction.outcome_uuid,
		)
		const outcome = prop.outcomes.find(
			(candidate) => candidate.outcome_uuid === prediction.outcome_uuid,
		)
		if (!outcome) return null

		const parsedMatch = await this.parseMatchString(prediction.match_string)
		const point = outcome.point ?? null
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
		const market = _.startCase(prop.market_key.replace('player_', ''))
		const date = this.dateManager.toMMDDYYYY(
			prop.event_context.commence_time,
		)
		const value = [
			`**Date**: ${date}`,
			`**Status**: ${status}`,
			`**Choice**: \`${choice}${point === null ? '' : ` ${point}`}\``,
			`**Market**: ${market}`,
			prediction.description?.trim()
				? `**Player:** ${prediction.description}`
				: null,
		]
			.filter((line): line is string => Boolean(line))
			.join('\n')

		return { name: parsedMatch, value, inline: false }
	}

	private async parseMatchString(matchString: string) {
		const [awayTeam, homeTeam] = matchString.split(' vs. ')
		if (!awayTeam || !homeTeam) return matchString
		const result = await TeamInfo.resolveTeamIdentifier({
			away_team: awayTeam,
			home_team: homeTeam,
		})
		return `${result.away_team} vs. ${result.home_team}`
	}

	private parseLeaderboardData(
		leaderboard: LeaderboardResponseWithStreaks,
	): ParsedLeaderboardEntry[] {
		return leaderboard.entries.map((entry, index) => ({
			userId: entry.user_id,
			position: index + 1,
			score:
				entry.correct_predictions * LEADERBOARD_SCORING.CORRECT_POINTS +
				entry.incorrect_predictions *
					LEADERBOARD_SCORING.INCORRECT_PENALTY,
			correctPredictions: entry.correct_predictions,
			incorrectPredictions: entry.incorrect_predictions,
			currentStreak: entry.current_streak,
			bestStreak: entry.best_streak,
			badgeTier: entry.badge_tier,
		}))
	}

	private async createLeaderboardEmbed(
		leaderboard: ParsedLeaderboardEntry[],
		currentPage: number,
	): Promise<EmbedBuilder> {
		const startIndex = (currentPage - 1) * 20
		const pageEntries = leaderboard.slice(startIndex, startIndex + 20)
		const totalPages = Math.ceil(leaderboard.length / 20)
		const description = await Promise.all(
			pageEntries.map(async (entry) => {
				const member = await this.getMember(entry.userId)
				const username = member?.username ?? entry.userId
				const total =
					entry.correctPredictions + entry.incorrectPredictions
				const streakBadge = formatStreakBadge(
					entry.currentStreak,
					entry.badgeTier,
				)
				return `${entry.position}. ${username}${streakBadge} - **\`${entry.score}\`** *(${entry.correctPredictions}/${total})*`
			}),
		)

		return new EmbedBuilder()
			.setTitle('Prediction Accuracy Leaderboard')
			.setColor(embedColors.PlutoBlue)
			.setDescription(description.join('\n'))
			.setFooter({
				text: `Page ${currentPage} of ${totalPages} | Total Entries: ${leaderboard.length} | 🔥3/5/10 = streak badge`,
			})
	}

	private async getMember(userId: string) {
		try {
			return await new ClientTools(this.container).resolveMember(userId)
		} catch (error) {
			this.container.logger.error(
				`Failed to resolve member ${userId}:`,
				error,
			)
			return null
		}
	}

	private async handlePagination(
		interaction: Subcommand.ChatInputCommandInteraction,
		reply: Message,
		leaderboard: ParsedLeaderboardEntry[],
	) {
		const totalPages = Math.ceil(leaderboard.length / 20)
		let currentPage = 1
		const collector = reply.createMessageComponentCollector({ time: 60000 })

		collector.on('collect', async (buttonInteraction) => {
			if (buttonInteraction.user.id !== interaction.user.id) {
				await buttonInteraction.followUp({
					content:
						'Only the original user can interact with these buttons.',
					ephemeral: true,
				})
				return
			}
			switch (buttonInteraction.customId) {
				case 'first':
					currentPage = 1
					break
				case 'previous':
					currentPage = Math.max(1, currentPage - 1)
					break
				case 'next':
					currentPage = Math.min(totalPages, currentPage + 1)
					break
				case 'last':
					currentPage = totalPages
					break
			}
			const embed = await this.createLeaderboardEmbed(
				leaderboard,
				currentPage,
			)
			await buttonInteraction.update({
				embeds: [embed],
				components: new Pagination().createPaginationButtons(
					currentPage,
					totalPages,
				),
			})
		})

		collector.on('end', async () => {
			const disabled = new Pagination()
				.createPaginationButtons(currentPage, totalPages)
				.map((row) => {
					for (const button of row.components)
						button.setDisabled(true)
					return row
				})
			await reply.edit({ components: disabled })
		})
	}
}

interface ParsedLeaderboardEntry {
	position: number
	userId: string
	score: number
	correctPredictions: number
	incorrectPredictions: number
	currentStreak: number
	bestStreak: number
	badgeTier: StreakBadgeTier
}
