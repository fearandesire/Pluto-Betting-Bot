import type { BetslipWithAggregationDTO, MatchDetailDto } from '@kh-openapi'
import {
	InteractionHandler,
	InteractionHandlerTypes,
} from '@sapphire/framework'
import type { ButtonInteraction, StringSelectMenuInteraction } from 'discord.js'
import { selectMenuIds } from '../lib/interfaces/interaction-handlers/interaction-handlers.interface.js'
import { BetsCacheService } from '../utils/api/common/bets/BetsCacheService.js'
import BetUtils from '../utils/api/common/bets/BetUtils.js'
import { BetslipManager } from '../utils/api/Khronos/bets/BetslipsManager.js'
import BetslipWrapper from '../utils/api/Khronos/bets/betslip-wrapper.js'
import MatchCacheService from '../utils/api/routes/cache/MatchCacheService.js'
import { CacheManager } from '../utils/cache/cache-manager.js'
import { ErrorEmbeds } from '../utils/common/errors/global.js'

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
		const matchDetails = await MatchCacheService.getInstance(
			new CacheManager(),
		).getMatch(selectedMatchId)

		if (!matchDetails) {
			await interaction.editReply({
				embeds: [
					await ErrorEmbeds.internalErr(
						'Due to an internal error, the match data selected is not available. Please try again later.',
					),
				],
			})
			return this.none()
		}
		const betsCacheService = new BetsCacheService(new CacheManager())
		// Retrieve user's cached bet
		const cachedBet = await betsCacheService.getUserBet(interaction.user.id)
		if (!cachedBet) {
			await interaction.editReply({
				embeds: [
					await ErrorEmbeds.internalErr(
						'Due to an internal error, your initial bet data was not found. Please try again later.',
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

		// Identify opponent
		const opponent = await BetUtils.identifyOpponent(
			matchDetails,
			cachedBet.team,
		)

		// Format commence_time to a readable date string
		const formattedDate = matchDetails.commence_time
			? new Date(matchDetails.commence_time)
					.toLocaleDateString('en-US', {
						month: 'short',
						day: 'numeric',
						hour: 'numeric',
						minute: '2-digit',
						timeZoneName: 'short',
					})
					.replace(/ ([A-Z]{3,5})$/, ' ($1)')
			: 'TBD'

		await betsCacheService.updateUserBet(interaction.user.id, {
			matchup_id: matchDetails.id,
			opponent,
			dateofmatchup: formattedDate,
			profit,
			payout,
		})

		// Get updated cached bet for payload
		const updatedBet = await betsCacheService.getUserBet(
			interaction.user.id,
		)

		return this.some({
			betslip: updatedBet,
			payData: { payout, profit },
			dateofmatchup: formattedDate,
			opponent,
		})
	}

	public async run(interaction: StringSelectMenuInteraction, payload: any) {
		if (interaction.customId !== selectMenuIds.matchup_select_team) {
			return
		}
		const { betslip, dateofmatchup, opponent, payData } = payload

		const matchCacheService = MatchCacheService.getInstance(
			new CacheManager(),
		)
		const matchDetails = await matchCacheService.getMatch(
			betslip.matchup_id,
		)

		if (!matchDetails) {
			await interaction.editReply({
				embeds: [
					await ErrorEmbeds.internalErr(
						'Due to an internal error, the match data is not available. Please try again later.',
					),
				],
			})
			return
		}

		const betslipForPresentation: BetslipWithAggregationDTO = {
			userid: betslip.userid,
			isNewUser: betslip.isNewUser ?? false,
			team: betslip.team,
			amount: betslip.amount,
			profit: betslip.profit,
			payout: betslip.payout,
			opponent: betslip.opponent,
			dateofmatchup: betslip.dateofmatchup,
			match: matchDetails,
		}

		return new BetslipManager(
			new BetslipWrapper(),
			new BetsCacheService(new CacheManager()),
		).presentBetWithPay(interaction, {
			betslip: betslipForPresentation,
			payData,
			matchInfo: {
				dateofmatchup,
				opponent,
			},
		})
	}
}
