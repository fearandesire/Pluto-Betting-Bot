import {
	InteractionHandler,
	InteractionHandlerTypes,
} from '@sapphire/framework'
import { type ModalSubmitInteraction } from 'discord.js'
import {
	getParlayErrorMessage,
	logParlayBuilderError,
	ParlayBuilderService,
} from '../services/ParlayBuilderService.js'
import MatchCacheService from '../utils/api/routes/cache/match-cache-service.js'
import { CacheManager } from '../utils/cache/cache-manager.js'

export class ParlayModalHandler extends InteractionHandler {
	private readonly builderService = new ParlayBuilderService()
	private readonly matchCache = new MatchCacheService(new CacheManager())

	public constructor(
		ctx: InteractionHandler.LoaderContext,
		options: InteractionHandler.Options,
	) {
		super(ctx, {
			...options,
			interactionHandlerType: InteractionHandlerTypes.ModalSubmit,
		})
	}

	public override parse(interaction: ModalSubmitInteraction) {
		if (!interaction.customId.startsWith('parlay_modal_'))
			return this.none()
		const kind = interaction.customId.replace('parlay_modal_', '')
		if (kind !== 'add_leg' && kind !== 'stake') return this.none()
		return this.some({
			kind,
		})
	}

	public async run(
		interaction: ModalSubmitInteraction,
		payload: { kind: 'add_leg' | 'stake' },
	) {
		await interaction.deferReply({ ephemeral: true })
		const userId = interaction.user.id
		try {
			if (payload.kind === 'stake') {
				const rawStake = interaction.fields
					.getTextInputValue('parlay_stake')
					.trim()
				if (!/^\d+$/.test(rawStake))
					throw new Error('Stake must be a whole number. Try again.')
				const session = await this.builderService.setStake(
					userId,
					Number(rawStake),
				)
				return interaction.editReply(
					this.builderService.render(session),
				)
			}

			const gameId =
				interaction.fields.getStringSelectValues('parlay_game')[0]
			const marketKey = interaction.fields.getStringSelectValues(
				'parlay_market',
			)[0] as 'h2h' | 'spreads' | 'totals'
			const side = interaction.fields.getStringSelectValues(
				'parlay_side',
			)[0] as 'home' | 'away' | 'over' | 'under'
			if (!gameId || !marketKey || !side)
				throw new Error('Choose a game, market, and side.')
			const match = await this.matchCache.getMatch(gameId)
			if (!match) throw new Error('Choose a valid game from the list.')
			if (marketKey === 'h2h' && (side === 'over' || side === 'under')) {
				throw new Error(
					'Over/Under is only valid for totals. Choose a team for moneyline.',
				)
			}
			if (
				(marketKey === 'spreads' || marketKey === 'h2h') &&
				(side === 'over' || side === 'under')
			) {
				throw new Error('That side is not valid for this market.')
			}
			if (
				marketKey === 'totals' &&
				(side === 'home' || side === 'away')
			) {
				throw new Error('Totals require Over or Under.')
			}
			const session = await this.builderService.addLeg(userId, {
				matchId: gameId,
				marketKey,
				side,
			})
			return interaction.editReply(this.builderService.render(session))
		} catch (error) {
			logParlayBuilderError(error, { userId, modal: payload.kind })
			return interaction.editReply(
				this.builderService.renderMessage(getParlayErrorMessage(error)),
			)
		}
	}
}
