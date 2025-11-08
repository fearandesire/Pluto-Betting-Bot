import { helpfooter } from '@pluto-config'
import {
	InteractionHandler,
	InteractionHandlerTypes,
} from '@sapphire/framework'
import type { ButtonInteraction } from 'discord.js'
import { EmbedBuilder } from 'discord.js'
import _ from 'lodash'
import { teamResolver } from 'resolve-team'
import embedColors from '../lib/colorsConfig.js'
import { ApiModules } from '../lib/interfaces/api/api.interface.js'
import { btnIds } from '../lib/interfaces/interaction-handlers/interaction-handlers.interface.js'
import {
	BetsCacheService,
	type CachedBetData,
} from '../utils/api/common/bets/BetsCacheService.js'
import { BetslipManager } from '../utils/api/Khronos/bets/BetslipsManager.js'
import BetslipWrapper from '../utils/api/Khronos/bets/betslip-wrapper.js'
import { ApiErrorHandler } from '../utils/api/Khronos/error-handling/ApiErrorHandler.js'
import PredictionApiWrapper from '../utils/api/Khronos/prediction/predictionApiWrapper.js'
import PropsApiWrapper from '../utils/api/Khronos/props/propsApiWrapper.js'
import { CacheManager } from '../utils/cache/cache-manager.js'
import { ErrorEmbeds } from '../utils/common/errors/global.js'
import TeamInfo from '../utils/common/TeamInfo.js'

/**
 * @module ButtonListener
 */
export class ButtonHandler extends InteractionHandler {
	private betsCacheService: BetsCacheService

	public constructor(
		ctx: InteractionHandler.LoaderContext,
		options: InteractionHandler.Options,
	) {
		super(ctx, {
			...options,
			interactionHandlerType: InteractionHandlerTypes.Button,
		})
		this.betsCacheService = new BetsCacheService(new CacheManager())
	}

	/**
	 * @summary Button Event Listener - collects & parses necessary data before processing
	 *
	 * Bet Handling:
	 * - 'Confirm Bet' - Collects data for the bet and matchup in cache
	 *   - Passes data to run > BetslipManager.placeBet
	 * @param interaction
	 */
	// @ts-ignore - Weird TS Error
	public override async parse(interaction: ButtonInteraction) {
		// ? Handle prop buttons
		if (_.startsWith(interaction.customId, 'prop_')) {
			await interaction.deferReply({ ephemeral: true })
			// ? Extract outcome UUID from button ID (format: prop_{uuid})
			const outcomeUuid = interaction.customId.replace('prop_', '')
			return this.some({ outcomeUuid })
		}

		// Handle matchup buttons
		if (_.startsWith(interaction.customId, 'matchup')) {
			// Cancel button
			if (interaction.customId === btnIds.matchup_btn_cancel) {
				await interaction.update({
					components: [],
				})
				return this.some({
					hasFailed: false,
				})
			}

			// Confirm button
			if (interaction.customId === btnIds.matchup_btn_confirm) {
				await interaction.deferUpdate()
				await interaction.editReply({
					components: [],
				})
				try {
					const cachedBet = await this.betsCacheService.getUserBet(
						interaction.user.id,
					)

					if (!cachedBet) {
						console.error({
							method: this.constructor.name,
							message: 'Cached bet not found',
							data: {
								userId: interaction.user.id,
							},
						})
						const errMsg = 'Unable to locate your bet data.'
						return this.some({
							hasFailed: true,
							errMsg: errMsg,
						})
					}

					// All necessary data is now in the cached bet - no need to fetch match separately
					return this.some({
						betslip: cachedBet,
					})
				} catch (error) {
					const errMsg =
						'An error occurred when collecting betslip data.'
					console.error({
						trace: this.constructor.name,
						message: errMsg,
						data: {
							error,
						},
					})
					return this.some({
						hasFailed: true,
						errMsg: errMsg,
					})
				}
			}
		}

		// If we reach here, it means we didn't handle the button
		return this.none()
	}

	public async run(interaction: ButtonInteraction, payload: ButtonPayload) {
		if ('hasFailed' in payload && payload.hasFailed) {
			const errMsg = payload.errMsg
			const errEmbed = await interaction.editReply({
				embeds: [await ErrorEmbeds.internalErr(errMsg)],
				components: [],
			})
			// delete after 10 secs
			// todo: add queue for this
			setTimeout(() => {
				errEmbed.delete().catch(console.error)
			}, 10000)
			return
		}

		// ? Handle Cancelling A Betslip
		if (interaction.customId === btnIds.matchup_btn_cancel) {
			const betslipWrapper = new BetslipWrapper()
			await betslipWrapper.clearPending(interaction.user.id)
			const cancelEmbed = new EmbedBuilder()
				.setTitle('Bet Canceled')
				.setDescription('Your bet has been successfully cancelled.')
				.setColor(embedColors.PlutoRed)
				.setThumbnail(interaction.user.displayAvatarURL())
				.setFooter({
					text: await helpfooter('betting'),
				})
			await interaction.editReply({
				embeds: [cancelEmbed],
				components: [],
			})
		}
		// ? Handle Confirming A Betslip
		else if (interaction.customId === btnIds.matchup_btn_confirm) {
			if ('betslip' in payload) {
				const { betslip } = payload

				// Sanitize and place the bet - all data is already in the cached betslip
				const sanitizedBetslip =
					await this.betsCacheService.sanitize(betslip)

				return new BetslipManager(
					new BetslipWrapper(),
					this.betsCacheService,
				).placeBet(interaction, sanitizedBetslip, {
					dateofmatchup: betslip.dateofmatchup,
					opponent: betslip.opponent,
				})
			}
		} else if ('outcomeUuid' in payload) {
			// ? Handle A Prediction
			const predictionApi = new PredictionApiWrapper()

			try {
				// Fetch prop to get sport and outcome details
				const propsApi = new PropsApiWrapper()
				const prop = await propsApi.getPropByUuid(payload.outcomeUuid)

				// Find the specific outcome
				const matchedOutcome = prop.outcomes.find(
					(o) => o.outcome_uuid === payload.outcomeUuid,
				)

				if (!matchedOutcome) {
					console.error({
						method: this.constructor.name,
						message: 'Could not find matching outcome',
						data: {
							outcomeUuid: payload.outcomeUuid,
							availableOutcomes: prop.outcomes.map(
								(o) => o.outcome_uuid,
							),
						},
					})
					return interaction.editReply({
						content:
							'An error occurred while processing your prediction. Please try again.',
					})
				}

				await predictionApi.createPrediction({
					createPredictionDto: {
						user_id: interaction.user.id,
						outcome_uuid: matchedOutcome.outcome_uuid,
						choice: matchedOutcome.name, // "Over" or "Under"
						status: 'pending',
						guild_id: interaction.guildId!,
						sport: prop.event_context.sport_title,
					},
				})

				// Format prediction in compact view format matching history style
				const formattedPrediction =
					await this.formatPredictionConfirmation(
						matchedOutcome,
						prop.market_key,
						prop.event_context,
					)

				const predictionEmbed = new EmbedBuilder()
					.setColor(embedColors.PlutoGreen)
					.setTitle('✅ Prediction Placed')
					.setDescription(
						'Your prediction has been recorded.\nView your predictions with `/predictions history`',
					)
					.addFields({
						name: '\u200B',
						value: formattedPrediction,
						inline: false,
					})
					.setTimestamp()

				await interaction.editReply({
					content: '',
					embeds: [predictionEmbed],
				})

				// Delete the ephemeral message after 10 seconds
				setTimeout(() => {
					interaction.deleteReply().catch(console.error)
				}, 10000)
			} catch (error: unknown) {
				console.error({
					method: this.constructor.name,
					message: 'Error occurred regarding predictions',
					data: {
						error,
					},
				})
				return new ApiErrorHandler().handle(
					interaction,
					error,
					ApiModules.predictions,
				)
			}
		}
	}

	/**
	 * Format prediction confirmation in compact view format matching history style
	 * Player format: **⏳ Player Name** (ABBREV vs. ABBREV)\nProp Type • **PICK Line**\n*<t:TIMESTAMP:d>*
	 * Team format: **⏳ Team Name**\nProp Type • **PICK Line**\n*<t:TIMESTAMP:d>*
	 */
	private async formatPredictionConfirmation(
		outcome: {
			name: string
			description?: string
			point?: number | null
		},
		marketKey: string,
		eventContext: {
			home_team: string
			away_team: string
			commence_time: string
		},
	): Promise<string> {
		const isPlayerPrediction =
			outcome.description && outcome.description.trim() !== ''

		let entityLine: string
		if (isPlayerPrediction) {
			const playerName = outcome.description!
			const awayTeamData = await teamResolver.resolve(
				eventContext.away_team,
				{ full: true },
			)
			const homeTeamData = await teamResolver.resolve(
				eventContext.home_team,
				{ full: true },
			)
			const awayAbbrev =
				awayTeamData?.abbrev ||
				TeamInfo.getTeamShortName(eventContext.away_team)
			const homeAbbrev =
				homeTeamData?.abbrev ||
				TeamInfo.getTeamShortName(eventContext.home_team)
			const matchupString = `${awayAbbrev} vs. ${homeAbbrev}`
			entityLine = `**⏳ ${playerName}** (${matchupString})`
		} else {
			// Handle spreads market - choice is team name
			const teamName = TeamInfo.getTeamShortName(outcome.name)
			entityLine = `**⏳ ${teamName}**`
		}

		const propType = _.startCase(
			marketKey.replace('player_', '').replace('_', ' '),
		)

		const pick = outcome.name.toUpperCase()
		const line =
			outcome.point !== null && outcome.point !== undefined
				? outcome.point.toString()
				: ''

		const timestamp = Math.floor(
			new Date(eventContext.commence_time).getTime() / 1000,
		)
		const formattedDate = `<t:${timestamp}:d>`

		const propLine = line
			? `${propType} • **${pick} ${line}**`
			: `${propType} • **${pick}**`

		return `${entityLine}\n${propLine}\n*${formattedDate}*`
	}
}

interface FailedPayload {
	hasFailed: true
	errMsg: string
}

interface ConfirmPayload {
	betslip: CachedBetData
}

interface PropPayload {
	outcomeUuid: string
}

type ButtonPayload = FailedPayload | ConfirmPayload | PropPayload
