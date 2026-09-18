import { PaginatedMessageEmbedFields } from '@sapphire/discord.js-utilities'
import { container } from '@sapphire/framework'
import type { Subcommand } from '@sapphire/plugin-subcommands'
import { EmbedBuilder } from 'discord.js'
import embedColors from '../../lib/colorsConfig.js'
import { ApiModules } from '../../lib/interfaces/api/api.interface.js'
import { ApiErrorHandler } from '../api/Khronos/error-handling/ApiErrorHandler.js'
import GuildWrapper from '../api/Khronos/guild/guild-wrapper.js'
import PredictionApiWrapper from '../api/Khronos/prediction/predictionApiWrapper.js'
import PropsApiWrapper from '../api/Khronos/props/props-api-wrapper.js'
import { DateManager } from '../common/DateManager.js'
import StringUtils from '../common/string-utils.js'
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

			// Build success message
			const responseLines: string[] = [
				`✅ Successfully posted **${result.posted}** player prop${result.posted !== 1 ? 's' : ''} to ${predictionChannel}`,
			]

			if (result.failed > 0) {
				responseLines.push(
					`❌ Failed to post **${result.failed}** prop${result.failed !== 1 ? 's' : ''}`,
				)
			}

			const embed = new EmbedBuilder()
				.setTitle('Player Props Posted')
				.setDescription(responseLines.join('\n'))
				.setColor(embedColors.PlutoGreen)
				.addFields(
					{
						name: 'Total Pairs',
						value: result.total.toString(),
						inline: true,
					},
					{
						name: 'Posted',
						value: result.posted.toString(),
						inline: true,
					},
					{
						name: 'Failed',
						value: result.failed.toString(),
						inline: true,
					},
				)
				.setTimestamp()

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

			const embed = new EmbedBuilder()
				.setTitle('Active Props - Pending Results')
				.setDescription(
					`Found **${totalOutcomes}** outcome${totalOutcomes !== 1 ? 's' : ''} with active predictions across **${dateGroups.length}** date${dateGroups.length !== 1 ? 's' : ''}.\nManage prop results in the Khronos admin dashboard.`,
				)
				.setColor(embedColors.PlutoBlue)
				.setTimestamp()

			const fields: Array<{
				name: string
				value: string
				inline: boolean
			}> = []

			for (const dateGroup of dateGroups) {
				const dateObj = new Date(dateGroup.date)
				const formattedDate = dateObj.toLocaleDateString('en-US', {
					weekday: 'short',
					month: 'short',
					day: 'numeric',
					year: 'numeric',
				})

				fields.push({
					name: `\u200B\n📅 ${formattedDate}`,
					value: '\u200B',
					inline: false,
				})

				// Add games and props for this date
				for (const game of dateGroup.games) {
					const gameTime = new DateManager().toDiscordUnix(
						game.commence_time,
					)
					const gameTotalPredictions = game.props.reduce(
						(sum, prop) => sum + prop.prediction_count,
						0,
					)

					fields.push({
						name: `🎯 ${game.matchup}`,
						value: `Time: ${gameTime} • ${gameTotalPredictions} prediction${gameTotalPredictions !== 1 ? 's' : ''}`,
						inline: false,
					})

					for (const prop of game.props) {
						const propParts: string[] = [
							`**Market:** ${StringUtils.toTitleCase(prop.market_key.replace(/_/g, ' '))}`,
						]

						if (prop.description) {
							propParts.push(`**Player:** ${prop.description}`)
						}

						if (prop.point !== null && prop.point !== undefined) {
							propParts.push(`**Line:** ${prop.point}`)
						}

						propParts.push(
							`**Predictions:** ${prop.prediction_count}`,
						)

						fields.push({
							name: `  └ 🎯 ${prop.outcome_uuid}`,
							value: `  ${propParts.join(' • ')}`,
							inline: false,
						})
					}
				}
			}

			if (fields.length <= 25) {
				embed.addFields(fields)
				await interaction.editReply({ embeds: [embed] })
			} else {
				const paginatedMsg = new PaginatedMessageEmbedFields({
					template: { embeds: [embed] },
				})
					.setItems(fields)
					.setItemsPerPage(5)
					.make()

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
