import {
	type PropOutcomeDetailDto,
	PropOutcomeDetailDtoOutcomeTypeEnum,
	type SetPropResultResponseDto,
} from '@pluto-khronos/api-client'
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
import { isValidUUID } from '../common/uuid-validation.js'
import { LogType } from '../logging/AppLog.interface.js'
import AppLog from '../logging/AppLog.js'
import { logger } from '../logging/WinstonLogger.js'
import { PropPostingHandler } from '../props/PropPostingHandler.js'

type SettleableSide = 'Over' | 'Under'

const OUTCOME_TYPE_BY_SIDE: Record<
	SettleableSide,
	PropOutcomeDetailDtoOutcomeTypeEnum
> = {
	Over: PropOutcomeDetailDtoOutcomeTypeEnum.Over,
	Under: PropOutcomeDetailDtoOutcomeTypeEnum.Under,
}

const OPPOSITE_SIDE: Record<SettleableSide, SettleableSide> = {
	Over: 'Under',
	Under: 'Over',
}

const isSettleableSide = (value: string): value is SettleableSide =>
	value === 'Over' || value === 'Under'

/**
 * Handler for admin props management commands
 * Handles generating, setting results, and viewing active props
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
	 * Handle /admin props setresult <prop_id> <result>
	 * Settles both sides of the prop's market: the side the admin declares as the
	 * winner is settled `won`, its counterpart `lost`. Khronos settles strictly
	 * per-outcome and never infers the paired outcome, so both calls are required.
	 */
	public async handleSetresult(
		interaction: Subcommand.ChatInputCommandInteraction,
	): Promise<void> {
		const propId = interaction.options.getString('prop_id', true)
		const result = interaction.options.getString('result', true)

		if (!interaction.guildId) {
			await interaction.reply({
				content: 'This command can only be used in a server.',
				ephemeral: true,
			})
			return
		}

		// Validate propId is a valid UUID format before sending to API
		if (!isValidUUID(propId)) {
			logger.error('Invalid UUID format received from autocomplete', {
				propId,
				propIdType: typeof propId,
				propIdLength: propId?.length,
				user_id: interaction.user.id,
				user_username: interaction.user.username,
				guild_id: interaction.guildId,
				result,
				context: 'AdminPropsHandler.handleSetresult',
			})
			await interaction.reply({
				content: `❌ Invalid prop ID format. Expected UUID, received: \`${propId.substring(0, 50)}${propId.length > 50 ? '...' : ''}\`\n\nPlease try selecting the prop again from the autocomplete menu.`,
				ephemeral: true,
			})
			return
		}

		if (!isSettleableSide(result)) {
			logger.error('Unrecognised side selected for prop settlement', {
				propId,
				result,
				user_id: interaction.user.id,
				guild_id: interaction.guildId,
				context: 'AdminPropsHandler.handleSetresult',
			})
			await interaction.reply({
				content: `❌ Unrecognised result \`${result}\`. Expected \`Over\` or \`Under\`. Nothing was settled.`,
				ephemeral: true,
			})
			return
		}

		const winningSide = result
		const losingSide = OPPOSITE_SIDE[winningSide]
		const propsApi = new PropsApiWrapper()

		try {
			await interaction.deferReply()

			// The admin picks one outcome, but each side of a market is a separate
			// outcome_uuid that must be settled by its own call. Resolve the whole
			// market from the selected outcome to obtain both UUIDs.
			const prop = await propsApi.getPropByUuid(propId)

			const winningOutcome = this.findOutcomeBySide(
				prop.outcomes,
				winningSide,
			)
			const losingOutcome = this.findOutcomeBySide(
				prop.outcomes,
				losingSide,
			)

			if (
				prop.outcomes.length !== 2 ||
				!winningOutcome ||
				!losingOutcome
			) {
				logger.error('Could not resolve an Over/Under pair for prop', {
					propId,
					winningSide,
					outcomeCount: prop.outcomes.length,
					outcomeTypes: prop.outcomes.map((o) => o.outcome_type),
					outcomeUuids: prop.outcomes.map((o) => o.outcome_uuid),
					user_id: interaction.user.id,
					guild_id: interaction.guildId,
					context: 'AdminPropsHandler.handleSetresult',
				})
				await interaction.editReply({
					content:
						`❌ Could not resolve a single **${winningSide}** outcome and a single **${losingSide}** outcome for this market, so nothing was settled.\n` +
						`Found ${prop.outcomes.length} outcome(s) with types: ${prop.outcomes
							.map((o) => o.outcome_type ?? 'unknown')
							.join(', ')}.\n` +
						'This prop must be settled manually — no predictions were changed.',
				})
				return
			}

			logger.info('Setting prop result', {
				propId,
				winningSide,
				won_outcome_uuid: winningOutcome.outcome_uuid,
				lost_outcome_uuid: losingOutcome.outcome_uuid,
				user_id: interaction.user.id,
				user_username: interaction.user.username,
				guild_id: interaction.guildId,
				context: 'AdminPropsHandler.handleSetresult',
			})

			const apiStartTime = Date.now()
			const wonResponse = await propsApi.setResult({
				propId: winningOutcome.outcome_uuid,
				result: 'won',
				guild_id: interaction.guildId,
			})

			// The won side is already settled and paid out from here on, so a failure
			// below is a partial settlement, not a no-op. It needs its own report.
			let lostResponse: SetPropResultResponseDto
			try {
				lostResponse = await propsApi.setResult({
					propId: losingOutcome.outcome_uuid,
					result: 'lost',
					guild_id: interaction.guildId,
				})
			} catch (losingSideError) {
				logger.error('Prop partially settled: losing side failed', {
					propId,
					winningSide,
					won_outcome_uuid: winningOutcome.outcome_uuid,
					lost_outcome_uuid: losingOutcome.outcome_uuid,
					user_id: interaction.user.id,
					guild_id: interaction.guildId,
					error:
						losingSideError instanceof Error
							? losingSideError.message
							: String(losingSideError),
					context: 'AdminPropsHandler.handleSetresult',
				})
				container.logger.error(losingSideError)
				await interaction.editReply({
					content:
						`⚠️ **Partial settlement — action needed.**\n` +
						`The **${winningSide}** side (\`${winningOutcome.outcome_uuid}\`) settled as **won**; those predictions are already paid out.\n` +
						`The **${losingSide}** side (\`${losingOutcome.outcome_uuid}\`) failed to settle as **lost** and is still unsettled.\n\n` +
						`Re-run this exact command (same prop and result: **${winningSide}**) to finish — the already-settled side is a no-op on a retry.`,
				})
				return
			}
			const apiDuration = Date.now() - apiStartTime

			logger.info('Prop result set successfully', {
				propId,
				winningSide,
				won_outcome_uuid: winningOutcome.outcome_uuid,
				won_correct_predictions: wonResponse.correct_predictions_count,
				won_total_predictions: wonResponse.total_predictions_count,
				lost_outcome_uuid: losingOutcome.outcome_uuid,
				lost_correct_predictions:
					lostResponse.correct_predictions_count,
				lost_total_predictions: lostResponse.total_predictions_count,
				apiDuration: `${apiDuration}ms`,
				user_id: interaction.user.id,
				guild_id: interaction.guildId,
			})

			const embed = this.createResultEmbed(
				{ side: winningSide, response: wonResponse },
				{ side: losingSide, response: lostResponse },
			)

			await AppLog.log({
				guildId: interaction.guildId,
				description: `Prop result updated for ${propId} in guild ${interaction.guildId}`,
				type: LogType.Info,
			})

			await interaction.editReply({ embeds: [embed] })
		} catch (error) {
			logger.error('Failed to set prop result', {
				propId,
				propIdType: typeof propId,
				propIdLength: propId?.length,
				result,
				user_id: interaction.user.id,
				guild_id: interaction.guildId,
				error: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
				context: 'AdminPropsHandler.handleSetresult',
			})
			container.logger.error(error)
			await new ApiErrorHandler().handle(
				interaction,
				error,
				ApiModules.props,
			)
		}
	}

	/**
	 * Resolve the single outcome matching a side by its `outcome_type` enum.
	 * Returns undefined unless exactly one outcome matches: `outcome_type` is
	 * absent on legacy props, and a market may hold more than the two sides, so
	 * an ambiguous or unlabelled market must never be settled by inference.
	 */
	private findOutcomeBySide(
		outcomes: PropOutcomeDetailDto[],
		side: SettleableSide,
	): PropOutcomeDetailDto | undefined {
		const matches = outcomes.filter(
			(outcome) => outcome.outcome_type === OUTCOME_TYPE_BY_SIDE[side],
		)
		return matches.length === 1 ? matches[0] : undefined
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
					`Found **${totalOutcomes}** outcome${totalOutcomes !== 1 ? 's' : ''} with active predictions across **${dateGroups.length}** date${dateGroups.length !== 1 ? 's' : ''}.\nUse \`/admin props setresult\` to settle these props.`,
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

	/**
	 * Create embed for a settled prop. Both sides are reported separately: a
	 * merged count would hide which side received which result.
	 */
	private createResultEmbed(
		won: { side: SettleableSide; response: SetPropResultResponseDto },
		lost: { side: SettleableSide; response: SetPropResultResponseDto },
	): EmbedBuilder {
		const summarise = (response: SetPropResultResponseDto): string =>
			[
				`Correct: **${response.correct_predictions_count}**`,
				`Incorrect: **${response.incorrect_predictions_count}**`,
				`Total: **${response.total_predictions_count}**`,
			].join('\n')

		return new EmbedBuilder()
			.setTitle('Prop Result Updated')
			.setDescription(
				`**${won.side}** won — both sides of the market were settled.`,
			)
			.setColor(embedColors.PlutoGreen)
			.addFields(
				{
					name: `✅ ${won.side} — won`,
					value: summarise(won.response),
					inline: true,
				},
				{
					name: `❌ ${lost.side} — lost`,
					value: summarise(lost.response),
					inline: true,
				},
			)
	}
}
