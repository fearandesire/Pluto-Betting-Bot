import {
	InteractionHandler,
	InteractionHandlerTypes,
} from '@sapphire/framework'
import type { ButtonInteraction } from 'discord.js'
import { BetslipManager } from '../utils/api/Khronos/bets/BetslipsManager.js'
import { btnIds } from '../lib/interfaces/interaction-handlers/interaction-handlers.interface.js'
import { BetsCacheService } from '../utils/api/common/bets/BetsCacheService.js'
import { CacheManager } from '@pluto-redis'
import MatchCacheService from '../utils/api/routes/cache/MatchCacheService.js'
import BetslipWrapper from '../utils/api/Khronos/bets/betslip-wrapper.js'
import MatchApiWrapper from '../utils/api/Khronos/matches/matchApiWrapper.js'
import { Match } from '@khronos-index'
import { ErrorEmbeds } from '../utils/errors/global.js'

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
			return this.none()
		}

		if (interaction.customId === `matchup_btn_confirm`) {
			console.info({
				method: this.constructor.name,
				message: 'Collecting bet data',
				data: {
					userId: interaction.user.id,
				},
			})
			await interaction.deferReply()
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
				return this.none()
			}
			const matchId = cachedBet.match.id
			let matchDetails: Match | null | undefined =
				await new MatchCacheService(new CacheManager()).getMatch(
					matchId,
				)

			if (!matchDetails) {
				// Fallback: Query for matches, find the match via ID in the array
				const matchesApi = new MatchApiWrapper()
				const { matches } = await matchesApi.getAllMatches()
				matchDetails = matches.find((match) => match.id === matchId)
				if (!matchDetails) {
					console.error({
						method: this.constructor.name,
						message: 'Match not found',
						data: {
							matchup_id: matchId,
						},
					})
					await interaction.reply({
						embeds: [
							ErrorEmbeds.internalErr(
								`Unable to locate the match data.`,
							),
						],
					})
					return this.none()
				}
				console.error({
					method: this.constructor.name,
					message: 'Match not found',
					data: {
						matchup_id: matchId,
					},
				})
				return this.none()
			}

			return this.some({
				betslip: cachedBet,
				matchData: matchDetails,
			})
		}
		return this.none()
	}

	public async run(interaction: ButtonInteraction, payload: any) {
		if (interaction.customId === btnIds.matchup_btn_confirm) {
			console.info({
				method: this.constructor.name,
				message: 'Placing bet',
				data: {
					betslip: payload.betslip,
					matchData: payload.matchData,
				},
			})
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
