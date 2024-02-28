import {
	InteractionHandler,
	InteractionHandlerTypes,
} from '@sapphire/framework'
import type { StringSelectMenuInteraction } from 'discord.js'
import { ButtonInteraction } from 'discord.js'
import { CacheManager } from '@pluto-redis'
import { ErrorEmbeds } from '../utils/errors/global.js'
import BetUtils from '../utils/api/common/bets/BetUtils.js'
import { BetsCacheService } from '../utils/api/common/bets/BetsCacheService.js'
import { isPendingBetslip } from '../lib/interfaces/api/bets/betslips-identify.js'
import { BetslipManager } from '../utils/api/Khronos/bets/BetslipsManager.js'
import { selectMenuIds } from '../lib/interfaces/interaction-handlers/interaction-handlers.interface.js'
import MatchCacheService from '../utils/api/routes/cache/MatchCacheService.js'
import BetslipWrapper from '../utils/api/Khronos/bets/betslip-wrapper.js'

export class MenuHandler extends InteractionHandler {
	public constructor(
		ctx: InteractionHandler.LoaderContext,
		options: InteractionHandler.Options,
	) {
		super(ctx, {
			...options,
			interactionHandlerType: InteractionHandlerTypes.SelectMenu,
		})
	}

	/**
	 * For when there is more than one match, we will use a select menu for the user.
	 * After selection, we collect necessary information to place the bet
	 * This includes:
	 * - Profit & Payout
	 * - Match Details: Date, Opponent, ID
	 *
	 * The users bet is saved into cache again with the updated information
	 * This is required for the next interaction in the betting process
	 * Where the user will be asked to confirm, or cancel the bet --
	 * @see [ButtonListener]{@link ./ButtonListener.ts}
	 * @param interaction
	 */

	public override async parse(interaction: StringSelectMenuInteraction) {
		const allSelectMenuIds = Object.values(selectMenuIds)
		if (!allSelectMenuIds.includes(interaction.customId as selectMenuIds)) {
			return this.none()
		}
		await interaction.deferReply()
		const selectedMatchId = interaction.values[0]
		// Get match details
		const matchDetails = await new MatchCacheService(
			new CacheManager(),
		).getMatch(selectedMatchId)

		if (!matchDetails) {
			await interaction.editReply({
				embeds: [
					ErrorEmbeds.internalErr(
						`Due to an internal error, the match data selected is not available. Please try again later.`,
					),
				],
			})
			return this.none()
		}
		const betsCacheService = new BetsCacheService(new CacheManager())
		// Retrieve user's cached bet
		const cachedBet = await betsCacheService.getUserBet(interaction.user.id)
		if (!cachedBet || !isPendingBetslip(cachedBet)) {
			await interaction.editReply({
				embeds: [
					ErrorEmbeds.internalErr(
						`Due to an internal error, your initial bet data was not found. Please try again later.`,
					),
				],
			})
			return this.none()
		}
		// Collect odds for the selected team
		const { selectedOdds } = await BetUtils.getOddsForTeam(
			cachedBet.team,
			matchDetails,
		)
		// Calculate Odds for the match based on the team
		const { profit, payout } = BetUtils.calculateProfitAndPayout(
			cachedBet.amount,
			selectedOdds,
		)
		await betsCacheService.cacheUserBet(interaction.user.id, {
			...cachedBet,
			profit,
			payout,
		})
		const opponent = await BetUtils.identifyOpponent(
			matchDetails,
			cachedBet.team,
		)
		return this.some({
			betslip: cachedBet,
			payData: { payout, profit },
			dateofmatchup: matchDetails.dateofmatchup,
			opponent,
		})
	}

	public async run(interaction: ButtonInteraction, payload: any) {
		if (interaction.customId !== selectMenuIds.matchup_select_team) {
			return
		}
		const { betslip, dateofmatchup, opponent, payData } = payload
		return new BetslipManager(
			new BetslipWrapper(),
			new BetsCacheService(new CacheManager()),
		).presentBetWithPay(interaction, {
			betslip,
			payData,
			matchInfo: {
				dateofmatchup,
				opponent,
			},
		})
	}
}
