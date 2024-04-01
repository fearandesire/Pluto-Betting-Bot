import {
	InteractionHandler,
	InteractionHandlerTypes,
} from '@sapphire/framework'
import type { ButtonInteraction } from 'discord.js'
import { EmbedBuilder } from 'discord.js'
import { BetslipManager } from '../utils/api/Khronos/bets/BetslipsManager.js'
import { btnIds } from '../lib/interfaces/interaction-handlers/interaction-handlers.interface.js'
import { BetsCacheService } from '../utils/api/common/bets/BetsCacheService.js'
import { CacheManager } from '@pluto-redis'
import MatchCacheService from '../utils/api/routes/cache/MatchCacheService.js'
import BetslipWrapper from '../utils/api/Khronos/bets/betslip-wrapper.js'
import MatchApiWrapper from '../utils/api/Khronos/matches/matchApiWrapper.js'
import { Match } from '@khronos-index'
import { ErrorEmbeds } from '../utils/common/errors/global.js'
import embedColors from '../lib/colorsConfig.js'
import { helpfooter } from '@pluto-core-config'

/**
 * @module ButtonListener
 */
export class ButtonHandler extends InteractionHandler {
	public constructor(
		ctx: InteractionHandler.LoaderContext,
		options: InteractionHandler.Options,
	) {
		super(ctx, {
			...options,
			interactionHandlerType: InteractionHandlerTypes.Button,
		})
	}

	/**
	 * @summary Button Event Listener - collects & parses necessary data before processing
	 *
	 * Bet Handling:
	 * - 'Confirm Bet' - Collects data for the bet and matchup in cache
	 *   - Passes data to run > BetslipManager.placeBet
	 * @param interaction
	 */
	public override async parse(interaction: ButtonInteraction) {
		const allBtnIds = Object.values(btnIds)
		if (!allBtnIds.includes(interaction.customId as btnIds)) {
			await interaction.update({
				components: [],
			})
			return this.none()
		}
		if (interaction.customId === `matchup_btn_cancel`) {
			await interaction.update({
				components: [],
			})

			return this.some()
		}
		if (interaction.customId === `matchup_btn_confirm`) {
			await interaction.deferUpdate()
			await interaction.editReply({
				components: [],
			})
			try {
				const cachedBet = await new BetsCacheService(
					new CacheManager(),
				).getUserBet(interaction.user.id)
				if (!cachedBet) {
					console.error({
						method: this.constructor.name,
						message: 'Cached bet not found',
						data: {
							userId: interaction.user.id,
						},
					})
					const errMsg = `Unable to locate your bet data.`
					return this.some({
						hasFailed: true,
						errMsg: errMsg,
					})
				}
				const matchId = cachedBet.match.id
				let locatedMatch: Match | null = await new MatchCacheService(
					new CacheManager(),
				).getMatch(matchId)

				// If the match is not found in cache, attempt to locate it via API
				if (!locatedMatch) {
					const matchesApi = new MatchApiWrapper()
					const { matches } = await matchesApi.getAllMatches()
					locatedMatch =
						matches.find((match: Match) => match.id === matchId) ??
						null

					if (!locatedMatch) {
						console.error({
							method: this.constructor.name,
							message: 'Match not found after API fetch',
							data: {
								matchup_id: matchId,
							},
						})
						return this.some({
							hasFailed: true,
							errMsg: `Unable to locate match data.`,
						})
					}
				}
				// Continue processing with the found match
				const matchDetails = locatedMatch
				return this.some({
					betslip: cachedBet,
					matchData: matchDetails,
				})
			} catch (error) {
				const errMsg = `An error occurred when collecting betslip or match data.`
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
		return this.none()
	}

	public async run(interaction: ButtonInteraction, payload: any) {
		if (payload?.hasFailed) {
			const errMsg = payload.errMsg
			await interaction.editReply({
				embeds: [ErrorEmbeds.internalErr(errMsg)],
				components: [],
			})
		}
		if (interaction.customId === btnIds.matchup_btn_cancel) {
			const betslipWrapper = new BetslipWrapper()
			await betslipWrapper.clearPending(interaction.user.id)
			const cancelEmbed = new EmbedBuilder()
				.setTitle('Bet Canceled')
				.setDescription(`Your bet has been successfully cancelled.`)
				.setColor(embedColors.PlutoRed)
				.setThumbnail(interaction.user.displayAvatarURL())
				.setFooter({
					text: helpfooter,
				})
			await interaction.editReply({
				embeds: [cancelEmbed],
				components: [],
			})
		} else if (interaction.customId === btnIds.matchup_btn_confirm) {
			const { betslip, matchData } = payload
			const matchOpponent = betslip.opponent

			const { dateofmatchup } = matchData
			const sanitizedBetslip = await new BetsCacheService(
				new CacheManager(),
			).sanitize(betslip)
			return new BetslipManager(
				new BetslipWrapper(),
				new BetsCacheService(new CacheManager()),
			).placeBet(interaction, sanitizedBetslip, {
				dateofmatchup,
				opponent: matchOpponent,
			})
		} else {
			return
		}
	}
}
