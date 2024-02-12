import {
	InteractionHandler,
	InteractionHandlerTypes,
} from '@sapphire/framework'
import type { ButtonInteraction } from 'discord.js'
import { BetslipManager } from '../utils/api/requests/bets/BetslipsManager.js'
import KhronosReqHandler from '../utils/api/common/KhronosReqHandler.js'
import { btnIds } from '../lib/interfaces/interaction-handlers/interaction-handlers.interface.js'
import { BetsCacheService } from '../utils/api/common/bets/BetsCacheService.js'
import { CacheManager } from '@pluto-redis'
import MatchCacheService from '../utils/api/routes/cache/MatchCacheService.js'

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

			const matchDetails = await new MatchCacheService(
				new CacheManager(),
			).getMatch(cachedBet.matchup_id)

			if (!matchDetails) {
				console.error({
					method: this.constructor.name,
					message: 'Match not found',
					data: {
						matchId: cachedBet.matchup_id,
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
			const { dateofmatchup, opponent } = matchData
			const betData = {
				betslip,
				dateofmatchup,
				opponent,
			}
			return new BetslipManager(
				new KhronosReqHandler(),
				new BetsCacheService(new CacheManager()),
			).placeBet(interaction, betData.betslip)
		} else {
			return
		}
	}
}
