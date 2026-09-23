import type { AllUserPredictionsDto } from '@pluto-khronos/api-client'
import { GetAllPredictionsFilteredStatusEnum } from '@pluto-khronos/api-client'
import { ApplyOptions } from '@sapphire/decorators'
import { Subcommand } from '@sapphire/plugin-subcommands'
import {
	type EmbedBuilder,
	InteractionContextType,
	type Message,
	PermissionFlagsBits,
} from 'discord.js'
import {
	leaderboardScore,
	predictionHistoryField,
	predictionHistoryPaginator,
	predictionHistoryTemplate,
	predictionLeaderboardEmbed,
	predictionStatsEmbed,
	resolveStreakBadgeTier,
} from '../../lib/discord/builders/props.js'
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
import type { StreakBadgeTier } from '../../utils/predictions/streak-display.js'

/**
 * Reserved command id for the consolidated group. Legacy aliases retain their
 * existing hints for one release and are removed with the alias pieces after
 * the migration window.
 */
const PREDICTIONS_COMMAND_ID_HINTS = ['1298280482123026537']

export {
	formatStreakBadge,
	resolveStreakBadgeTier,
} from '../../lib/discord/builders/props.js'

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
			const templateEmbed = predictionHistoryTemplate(
				user.username,
				status,
			)

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

			const paginatedMessage = predictionHistoryPaginator(
				templateEmbed,
				formattedPredictions,
			)

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
			const currentStreak = predictionStats?.current_streak ?? null
			const bestStreak = predictionStats?.best_streak ?? null
			const badgeTier = resolveStreakBadgeTier(
				currentStreak,
				predictionStats?.badge_tier ?? null,
			)
			const embed = predictionStatsEmbed({
				username: interaction.user.username,
				totalPredictions,
				correctPredictions,
				incorrectPredictions,
				winRate,
				pendingCount: pending.length,
				currentStreak,
				bestStreak,
				statsAvailable: predictionStats !== null,
				badgeTier,
			})

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
		return predictionHistoryField({
			prediction,
			matchLabel: parsedMatch,
			date: this.dateManager.toMMDDYYYY(prop.event_context.commence_time),
			point: outcome.point ?? null,
			marketKey: prop.market_key,
		})
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
			score: leaderboardScore(
				entry.correct_predictions,
				entry.incorrect_predictions,
			),
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
		const rows = await Promise.all(
			pageEntries.map(async (entry) => {
				const member = await this.getMember(entry.userId)
				return {
					...entry,
					username: member?.username ?? entry.userId,
				}
			}),
		)
		return predictionLeaderboardEmbed(rows, currentPage, leaderboard.length)
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
