import { container } from '@sapphire/framework'
import type { Subcommand } from '@sapphire/plugin-subcommands'
import {
	activePropsEmbed,
	activePropsFields,
	fieldsPaginator,
	propsPostedEmbed,
} from '../../lib/discord/builders/admin.js'
import { ApiModules } from '../../lib/interfaces/api/api.interface.js'
import { ApiErrorHandler } from '../api/Khronos/error-handling/ApiErrorHandler.js'
import GuildWrapper from '../api/Khronos/guild/guild-wrapper.js'
import PredictionApiWrapper from '../api/Khronos/prediction/predictionApiWrapper.js'
import PropsApiWrapper from '../api/Khronos/props/props-api-wrapper.js'
import { LogType } from '../logging/AppLog.interface.js'
import AppLog from '../logging/AppLog.js'
import { logger } from '../logging/WinstonLogger.js'
import { PropPostingHandler } from '../props/PropPostingHandler.js'

/**
 * Handler for admin props management commands
 * Handles generating and viewing active props
 */
export class AdminPropsHandler {
	/**
	 * Handle /admin props generate [count]
	 * Generate and post prop embeds to the prediction channel
	 */
	public async handleGenerate(
		interaction: Subcommand.ChatInputCommandInteraction,
	): Promise<void> {
		await interaction.deferReply()

		const count = interaction.options.getInteger('count') || 10
		const propsApi = new PropsApiWrapper()
		const guildWrapper = new GuildWrapper()

		try {
			await interaction.editReply({
				content: `Generating ${count} player prop${count > 1 ? 's' : ''}, please wait...`,
			})

			// Get guild information to determine sport
			const guild = await guildWrapper.getGuild(interaction.guildId)

			logger.info(`📤 Requesting ${count} prop pairs from Khronos`, {
				guildId: interaction.guildId,
				sport: guild.sport,
				requestedCount: count,
			})

			// Fetch paired props from Khronos
			const pairedProps = await propsApi.getProcessedProps(
				guild.sport as 'nba' | 'nfl',
				count,
			)

			logger.info(
				`📥 Received ${pairedProps.length} prop pairs from Khronos`,
				{
					guildId: interaction.guildId,
					sport: guild.sport,
					requestedCount: count,
					receivedPairs: pairedProps.length,
				},
			)

			// Post props to prediction channel
			const postingHandler = new PropPostingHandler()
			const result = await postingHandler.postPropsToChannel(
				interaction.guildId,
				pairedProps,
				guild.sport as 'nba' | 'nfl',
			)

			// Get prediction channel for mention in response
			const predictionChannel = await guildWrapper.getPredictionChannel(
				interaction.guildId,
			)

			const embed = propsPostedEmbed(result, `${predictionChannel}`)

			await interaction.editReply({
				content: '',
				embeds: [embed],
			})

			await AppLog.log({
				guildId: interaction.guildId,
				description: `${interaction.user.username} posted ${result.posted} player prop embeds to prediction channel`,
				type: LogType.Info,
			})
		} catch (error) {
			container.logger.error(error)

			// Check if error is due to missing prediction channel config
			if (
				error instanceof Error &&
				error.message.includes('Prediction channel not configured')
			) {
				await interaction.editReply({
					content:
						'❌ This guild does not have a prediction channel configured. Please set one up using the guild configuration commands.',
				})
				return
			}

			await new ApiErrorHandler().handle(
				interaction,
				error,
				ApiModules.props,
			)
		}
	}

	/**
	 * Handle /admin props viewactive
	 * View all props with active predictions
	 */
	public async handleViewactive(
		interaction: Subcommand.ChatInputCommandInteraction,
	): Promise<void> {
		await interaction.deferReply()

		try {
			const predictionApi = new PredictionApiWrapper()

			const dateGroups = await predictionApi.getActiveOutcomesGrouped({
				guildId: interaction.guildId,
			})

			if (!dateGroups || dateGroups.length === 0) {
				await interaction.editReply({
					content:
						'No active predictions found. All props have been settled!',
				})
				return
			}

			const totalOutcomes = dateGroups.reduce(
				(dateAcc, dateGroup) =>
					dateAcc +
					dateGroup.games.reduce(
						(gameAcc, game) => gameAcc + game.props.length,
						0,
					),
				0,
			)

			if (totalOutcomes === 0) {
				await interaction.editReply({
					content:
						'No active predictions found. All props have been settled!',
				})
				return
			}

			const embed = activePropsEmbed(totalOutcomes, dateGroups.length)
			const fields = activePropsFields(dateGroups)

			if (fields.length <= 25) {
				embed.addFields(fields)
				await interaction.editReply({ embeds: [embed] })
			} else {
				const paginatedMsg = fieldsPaginator(embed, fields)

				await paginatedMsg.run(interaction)
			}

			await AppLog.log({
				guildId: interaction.guildId,
				description: `${interaction.user.username} viewed ${totalOutcomes} active prop outcomes across ${dateGroups.length} date(s)`,
				type: LogType.Info,
			})
		} catch (error) {
			container.logger.error(error)
			await new ApiErrorHandler().handle(
				interaction,
				error,
				ApiModules.props,
			)
		}
	}
}
