import {
	InteractionHandler,
	InteractionHandlerTypes,
} from '@sapphire/framework'
import type { StringSelectMenuInteraction } from 'discord.js'
import { BetslipManager } from '../utils/api/requests/bets/BetslipsManager.js'
import { IPendingBetslip } from '../lib/interfaces/api/bets/betslips.interfaces.js'
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

	public override async parse(interaction: StringSelectMenuInteraction) {
		if (interaction.customId !== 'select_matchup') return this.none()
		// Perform an asynchronous operation to fetch pending bet details
		const pendingBetDetails: IPendingBetslip | null =
			await new BetslipManager().fetchPendingBet(interaction.user.id)
		if (pendingBetDetails === null) {
			interaction.reply({
				content:
					'An error occurred when collecting your initial betslip details.',
			})
			return this.none()
		}
		return this.some({
			interaction,
			action: {
				type: `select`,
				id: `select_matchup`,
			},
			data: pendingBetDetails,
		})
	}

	public override async run(payload: any) {
		if (payload.action.type !== 'select') return
		const { interaction, data } = payload
		const { amount, team } = data
		const selectedMatchID = interaction.values[0]
		return new BetslipManager().placeBet(interaction, {
			team,
			amount,
			matchup_id: selectedMatchID,
		})
	}
}
