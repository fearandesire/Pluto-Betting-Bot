import {
	InteractionHandler,
	InteractionHandlerTypes,
} from '@sapphire/framework'
import { MessageFlags, type ModalSubmitInteraction } from 'discord.js'
import {
	getParlayErrorMessage,
	logParlayBuilderError,
	type ParlayBuilderIdentity,
	ParlayBuilderService,
	type ParlayModalKind,
	parseParlayModalId,
	STALE_PARLAY_BUILDER_MESSAGE,
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
		const parsed = parseParlayModalId(interaction.customId)
		if (parsed) return this.some(parsed)
		if (interaction.customId.startsWith('parlay_modal_')) {
			return this.some({ kind: 'legacy' as const })
		}
		return this.none()
	}

	public async run(
		interaction: ModalSubmitInteraction,
		payload:
			| ({ kind: ParlayModalKind } & ParlayBuilderIdentity)
			| { kind: 'legacy' },
	) {
		if (payload.kind === 'legacy') {
			return interaction.reply({
				content: STALE_PARLAY_BUILDER_MESSAGE,
				flags: MessageFlags.Ephemeral,
			})
		}
		const userId = interaction.user.id
		const guildId = interaction.guildId
		if (!guildId) {
			return interaction.reply({
				content: 'Parlays can only be built inside a server.',
				flags: MessageFlags.Ephemeral,
			})
		}
		const updateBuilder = async (
			options: ReturnType<ParlayBuilderService['render']>,
			confirmation = 'Parlay builder updated.',
		) => {
			if (interaction.isFromMessage() && interaction.message) {
				await interaction.message.edit(options)
				return interaction.reply({
					content: confirmation,
					flags: MessageFlags.Ephemeral,
				})
			}
			if (!interaction.deferred && !interaction.replied) {
				await interaction.deferReply({ ephemeral: true })
			}
			return interaction.editReply(options)
		}
		try {
			const expected = {
				sessionId: payload.sessionId,
				revision: payload.revision,
			}
			if (payload.kind === 'stake') {
				const rawStake = interaction.fields
					.getTextInputValue('parlay_stake')
					.trim()
				if (!/^\d+$/.test(rawStake))
					throw new Error('Stake must be a whole number. Try again.')
				const session = await this.builderService.setStake(
					userId,
					guildId,
					expected,
					Number(rawStake),
				)
				return updateBuilder(this.builderService.render(session))
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
			const session = await this.builderService.addLeg(
				userId,
				guildId,
				expected,
				{
					matchId: gameId,
					marketKey,
					side,
				},
			)
			return updateBuilder(this.builderService.render(session))
		} catch (error) {
			logParlayBuilderError(error, { userId, modal: payload.kind })
			if (interaction.isFromMessage() && interaction.message) {
				return interaction.reply({
					content: getParlayErrorMessage(error),
					flags: MessageFlags.Ephemeral,
				})
			}
			return updateBuilder(
				this.builderService.renderMessage(getParlayErrorMessage(error)),
				'Unable to update parlay builder.',
			)
		}
	}
}
