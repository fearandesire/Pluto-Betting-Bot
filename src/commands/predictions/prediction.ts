import { ApplyOptions } from '@sapphire/decorators'
import { PaginatedFieldMessageEmbed } from '@sapphire/discord.js-utilities'
import { Subcommand } from '@sapphire/plugin-subcommands'
import {
	EmbedBuilder,
	InteractionContextType,
	PermissionFlagsBits,
} from 'discord.js'
import _ from 'lodash'
import { teamResolver } from 'resolve-team'
import embedColors from '../../lib/colorsConfig.js'
import { GetAllPredictionsFilteredStatusEnum } from '../../openapi/khronos/apis/PredictionApi.js'
import type { AllUserPredictionsDto } from '../../openapi/khronos/models/AllUserPredictionsDto.js'
import PredictionApiWrapper from '../../utils/api/Khronos/prediction/predictionApiWrapper.js'
import PropsApiWrapper from '../../utils/api/Khronos/props/propsApiWrapper.js'
import TeamInfo from '../../utils/common/TeamInfo.js'

/**
 * User-facing prediction command for viewing personal prediction history and stats
 */
@ApplyOptions<Subcommand.Options>({
	name: 'prediction',
	description: 'View your predictions',
	requiredClientPermissions: [
		PermissionFlagsBits.SendMessages,
		PermissionFlagsBits.EmbedLinks,
	],
	subcommands: [
		{ name: 'history', chatInputRun: 'handleHistory' },
		{ name: 'stats', chatInputRun: 'handleStats' },
	],
})
export class UserCommand extends Subcommand {
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
							.setDescription('View your prediction history')
							.addStringOption((option) =>
								option
									.setName('view')
									.setDescription('Which predictions to view')
									.setRequired(true)
									.addChoices(
										{
											name: '⏳ Pending',
											value: 'pending',
										},
										{
											name: '✅ Completed',
											value: 'completed',
										},
									),
							),
					)
					.addSubcommand((subcommand) =>
						subcommand
							.setName('stats')
							.setDescription('View your prediction statistics'),
					),
			{ idHints: ['1298280482123026536'] },
		)
	}

	/**
	 * Handle /predictions history subcommand
	 */
	public async handleHistory(
		interaction: Subcommand.ChatInputCommandInteraction,
	) {
		await interaction.deferReply({ ephemeral: true })

		const view = interaction.options.getString('view', true) as
			| 'pending'
			| 'completed'
		const user = interaction.user

		try {
			const predictionApiWrapper = new PredictionApiWrapper()
			const usersPredictions =
				await predictionApiWrapper.getPredictionsForUser({
					userId: user.id,
				})

			if (!usersPredictions || usersPredictions.length === 0) {
				return interaction.editReply({
					content: "You haven't made any predictions yet.",
				})
			}

			switch (view) {
				case 'pending':
					return this.showPendingView(interaction, usersPredictions)
				case 'completed':
					return this.showCompletedView(interaction, usersPredictions)
			}
		} catch (error) {
			this.container.logger.error(error)
			return interaction.editReply({
				content: 'An error occurred while fetching your predictions.',
			})
		}
	}

	/**
	 * Handle /predictions stats subcommand
	 */
	public async handleStats(
		interaction: Subcommand.ChatInputCommandInteraction,
	) {
		await interaction.deferReply({ ephemeral: true })

		const user = interaction.user

		try {
			const predictionApiWrapper = new PredictionApiWrapper()
			const usersPredictions =
				await predictionApiWrapper.getPredictionsForUser({
					userId: user.id,
				})

			if (!usersPredictions || usersPredictions.length === 0) {
				return interaction.editReply({
					content: "You haven't made any predictions yet.",
				})
			}

			// Calculate statistics
			const totalPredictions = usersPredictions.length
			const completedPredictions = usersPredictions.filter(
				(p) =>
					p.status === GetAllPredictionsFilteredStatusEnum.Completed,
			)
			const pendingPredictions = usersPredictions.filter(
				(p) => p.status === GetAllPredictionsFilteredStatusEnum.Pending,
			)

			const correctPredictions = completedPredictions.filter(
				(p) => p.is_correct === true,
			)
			const incorrectPredictions = completedPredictions.filter(
				(p) => p.is_correct === false,
			)

			const winRate =
				completedPredictions.length > 0
					? (
							(correctPredictions.length /
								completedPredictions.length) *
							100
						).toFixed(1)
					: '0.0'

			const embed = new EmbedBuilder()
				.setTitle('📊 Prediction Statistics')
				.setColor(embedColors.PlutoBlue)
				.setDescription(`Stats for ${user.username}`)
				.addFields(
					{
						name: 'Total Predictions',
						value: `\`${totalPredictions}\``,
						inline: true,
					},
					{
						name: 'Win Rate',
						value: `\`${winRate}%\``,
						inline: true,
					},
					{ name: '\u200B', value: '\u200B', inline: true },
					{
						name: '✅ Correct',
						value: `\`${correctPredictions.length}\``,
						inline: true,
					},
					{
						name: '❌ Incorrect',
						value: `\`${incorrectPredictions.length}\``,
						inline: true,
					},
					{
						name: '⏳ Pending',
						value: `\`${pendingPredictions.length}\``,
						inline: true,
					},
				)
				.setTimestamp()

			return interaction.editReply({ embeds: [embed] })
		} catch (error) {
			this.container.logger.error(error)
			return interaction.editReply({
				content: 'An error occurred while fetching your statistics.',
			})
		}
	}

	/**
	 * Show pending predictions view with detailed format
	 */
	private async showPendingView(
		interaction: Subcommand.ChatInputCommandInteraction,
		predictions: AllUserPredictionsDto[],
	) {
		const pending = predictions.filter(
			(p) => p.status === GetAllPredictionsFilteredStatusEnum.Pending,
		)

		if (pending.length === 0) {
			return interaction.editReply({
				content: 'You have no pending predictions.',
			})
		}

		type FormattedPrediction = {
			formattedText: string
		}

		const formattedPredictions = await Promise.all(
			pending.map(async (p): Promise<FormattedPrediction> => {
				const outcome = await this.getOutcomeDetails(p.outcome_uuid)
				const formattedText = await this.formatPredictionCompact(
					p,
					outcome,
					null,
				)

				return {
					formattedText,
				}
			}),
		)

		const templateEmbed = new EmbedBuilder()
			.setTitle('⏳ Your Pending Predictions')
			.setDescription(
				`You have ${pending.length} active prediction${
					pending.length !== 1 ? 's' : ''
				}`,
			)
			.setColor(embedColors.PlutoYellow)

		const paginatedMsg =
			new PaginatedFieldMessageEmbed<FormattedPrediction>()
				.setTitleField('\u200B')
				.setTemplate(templateEmbed)
				.setItems(formattedPredictions)
				.setItemsPerPage(5)
				.formatItems((item) => item.formattedText)
				.make()

		return paginatedMsg.run(interaction)
	}

	/**
	 * Show completed predictions view with compact format
	 */
	private async showCompletedView(
		interaction: Subcommand.ChatInputCommandInteraction,
		predictions: AllUserPredictionsDto[],
	) {
		const completed = predictions.filter(
			(p) => p.status !== GetAllPredictionsFilteredStatusEnum.Pending,
		)

		if (completed.length === 0) {
			return interaction.editReply({
				content: 'You have no completed predictions yet.',
			})
		}

		const correct = completed.filter(
			(p) =>
				p.status === GetAllPredictionsFilteredStatusEnum.Completed &&
				p.is_correct === true,
		).length
		const incorrect = completed.length - correct

		type FormattedCompletedPrediction = {
			formattedText: string
		}

		const formattedPredictions = await Promise.all(
			completed.map(async (p): Promise<FormattedCompletedPrediction> => {
				// Determine if prediction is correct (only for Completed status)
				let isCorrect: boolean | null = null
				if (
					p.status === GetAllPredictionsFilteredStatusEnum.Completed
				) {
					isCorrect = p.is_correct === true
				}
				const outcome = await this.getOutcomeDetails(p.outcome_uuid)
				const formattedText = await this.formatPredictionCompact(
					p,
					outcome,
					isCorrect,
				)

				return {
					formattedText,
				}
			}),
		)

		const templateEmbed = new EmbedBuilder()
			.setTitle('📊 Your Completed Predictions')
			.setDescription(`${correct} correct • ${incorrect} incorrect`)
			.setColor(embedColors.PlutoBlue)

		const paginatedMsg =
			new PaginatedFieldMessageEmbed<FormattedCompletedPrediction>()
				.setTitleField('\u200B')
				.setTemplate(templateEmbed)
				.setItems(formattedPredictions)
				.setItemsPerPage(8)
				.formatItems((item) => item.formattedText)
				.make()

		return paginatedMsg.run(interaction)
	}

	/**
	 * Get outcome details from prop API
	 */
	private async getOutcomeDetails(outcomeUuid: string): Promise<{
		name: string
		description?: string
		point: number
		market_key: string
		event_context: {
			home_team: string
			away_team: string
		}
	} | null> {
		try {
			const propApiWrapper = new PropsApiWrapper()
			const prop = await propApiWrapper.getPropByUuid(outcomeUuid)

			const outcome = prop.outcomes.find(
				(o) => o.outcome_uuid === outcomeUuid,
			)

			if (!outcome) return null

			return {
				name: outcome.name,
				description: outcome.description,
				point: outcome.point,
				market_key: prop.market_key,
				event_context: prop.event_context,
			}
		} catch (error) {
			this.container.logger.error(
				'Failed to fetch outcome details:',
				error,
			)
			return null
		}
	}

	/**
	 * Formats a prediction choice with point and market information
	 */
	private formatPredictionChoice(
		choice: string,
		point: number | undefined,
		marketKey: string,
	): string {
		const upperChoice = choice.toUpperCase()
		const marketName = _.startCase(marketKey.replace('player_', ''))

		if (point !== null && point !== undefined) {
			return `${upperChoice} ${point} ${marketName}`
		}

		return `${upperChoice} ${marketName}`
	}

	/**
	 * Format prediction in compact view format
	 * Player format: **✅ Player Name** (ABBREV vs. ABBREV)\nProp Type • **PICK Line**\n*<t:TIMESTAMP:d>*
	 * Team format: **✅ Team Name**\nProp Type • **PICK Line**\n*<t:TIMESTAMP:d>*
	 */
	private async formatPredictionCompact(
		prediction: AllUserPredictionsDto,
		outcome: {
			name: string
			description?: string
			point: number
			market_key: string
			event_context: {
				home_team: string
				away_team: string
			}
		} | null,
		isCorrect: boolean | null,
	): Promise<string> {
		if (!outcome) {
			return 'Unknown prediction'
		}

		const result =
			isCorrect === true ? '✅' : isCorrect === false ? '❌' : '⏳'
		const isPlayerPrediction =
			outcome.description && outcome.description.trim() !== ''

		let entityLine: string
		if (isPlayerPrediction) {
			const playerName = outcome.description!
			let matchupString: string
			if (prediction.match_string) {
				const [awayTeam, homeTeam] =
					prediction.match_string.split(' vs. ')
				const awayTeamData = await teamResolver.resolve(
					awayTeam || outcome.event_context.away_team,
					{ full: true },
				)
				const homeTeamData = await teamResolver.resolve(
					homeTeam || outcome.event_context.home_team,
					{ full: true },
				)
				const awayAbbrev =
					awayTeamData?.abbrev ||
					TeamInfo.getTeamShortName(
						awayTeam || outcome.event_context.away_team,
					)
				const homeAbbrev =
					homeTeamData?.abbrev ||
					TeamInfo.getTeamShortName(
						homeTeam || outcome.event_context.home_team,
					)
				matchupString = `${awayAbbrev} vs. ${homeAbbrev}`
			} else {
				const awayTeamData = await teamResolver.resolve(
					outcome.event_context.away_team,
					{ full: true },
				)
				const homeTeamData = await teamResolver.resolve(
					outcome.event_context.home_team,
					{ full: true },
				)
				const awayAbbrev =
					awayTeamData?.abbrev ||
					TeamInfo.getTeamShortName(outcome.event_context.away_team)
				const homeAbbrev =
					homeTeamData?.abbrev ||
					TeamInfo.getTeamShortName(outcome.event_context.home_team)
				matchupString = `${awayAbbrev} vs. ${homeAbbrev}`
			}
			entityLine = `**${result} ${playerName}** (${matchupString})`
		} else {
			const teamName = TeamInfo.getTeamShortName(outcome.name)
			entityLine = `**${result} ${teamName}**`
		}

		const propType = _.startCase(
			outcome.market_key.replace('player_', '').replace('_', ' '),
		)

		const pick = prediction.choice.toUpperCase()
		const line =
			outcome.point !== null && outcome.point !== undefined
				? outcome.point.toString()
				: ''

		const timestamp = Math.floor(
			new Date(prediction.created_at).getTime() / 1000,
		)
		const formattedDate = `<t:${timestamp}:d>`

		const propLine = line
			? `${propType} • **${pick} ${line}**`
			: `${propType} • **${pick}**`

		return `${entityLine}\n${propLine}\n*${formattedDate}*`
	}

	private async parseMatchString(matchString: string) {
		const [awayTeam, homeTeam] = matchString.split(' vs. ')
		const result = await TeamInfo.resolveTeamIdentifier({
			away_team: awayTeam,
			home_team: homeTeam,
		})

		return `${result.away_team} vs. ${result.home_team}`
	}
}
