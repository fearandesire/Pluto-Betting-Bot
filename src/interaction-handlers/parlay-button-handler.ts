import {
	InteractionHandler,
	InteractionHandlerTypes,
} from '@sapphire/framework'
import {
	type ButtonInteraction,
	LabelBuilder,
	MessageFlags,
	ModalBuilder,
	StringSelectMenuBuilder,
	TextInputBuilder,
	TextInputStyle,
} from 'discord.js'
import {
	getParlayErrorMessage,
	logParlayBuilderError,
	ParlayBuilderService,
} from '../services/ParlayBuilderService.js'
import { BetsCacheService } from '../utils/api/common/bets/BetsCacheService.js'
import { BetslipManager } from '../utils/api/Khronos/bets/BetslipsManager.js'
import BetslipWrapper from '../utils/api/Khronos/bets/betslip-wrapper.js'
import ParlayApiWrapper from '../utils/api/Khronos/parlays/ParlayApiWrapper.js'
import MatchCacheService from '../utils/api/routes/cache/match-cache-service.js'
import { CacheManager } from '../utils/cache/cache-manager.js'

const removeId = /^parlay_btn_remove_(\d+)$/

export class ParlayButtonHandler extends InteractionHandler {
	private readonly builderService = new ParlayBuilderService()
	private readonly parlayApi = new ParlayApiWrapper()
	private readonly matchCache = new MatchCacheService(new CacheManager())

	public constructor(
		ctx: InteractionHandler.LoaderContext,
		options: InteractionHandler.Options,
	) {
		super(ctx, {
			...options,
			interactionHandlerType: InteractionHandlerTypes.Button,
		})
	}

	public override async parse(interaction: ButtonInteraction) {
		if (!interaction.customId.startsWith('parlay_btn_')) return this.none()
		if (interaction.customId === 'parlay_btn_add') {
			try {
				await interaction.showModal(await this.buildAddLegModal())
			} catch (error) {
				logParlayBuilderError(error, {
					action: 'open_add_leg_modal',
					userId: interaction.user.id,
				})
				await interaction.reply({
					content:
						error instanceof Error
							? error.message
							: 'No upcoming games are available right now.',
					ephemeral: true,
				})
			}
			return this.none()
		}
		if (interaction.customId === 'parlay_btn_stake') {
			await interaction.showModal(this.buildStakeModal())
			return this.none()
		}
		const removeMatch = removeId.exec(interaction.customId)
		if (removeMatch) {
			await interaction.deferUpdate()
			return this.some({
				action: 'remove',
				index: Number(removeMatch[1]),
			})
		}
		if (interaction.customId === 'parlay_btn_cancel') {
			await interaction.deferUpdate()
			return this.some({ action: 'cancel' })
		}
		if (interaction.customId === 'parlay_btn_confirm') {
			await interaction.deferUpdate()
			return this.some({ action: 'confirm' })
		}
		return this.none()
	}

	public async run(
		interaction: ButtonInteraction,
		payload:
			| { action: 'remove'; index: number }
			| { action: 'cancel' }
			| { action: 'confirm' },
	) {
		const userId = interaction.user.id
		const guildId = interaction.guildId
		try {
			if (!guildId) {
				throw new Error('Parlays can only be built inside a server.')
			}
			if (payload.action === 'cancel') {
				await this.builderService.clear(userId, guildId)
				return interaction.editReply(
					this.builderService.renderMessage(
						'Parlay builder cancelled.',
					),
				)
			}
			if (payload.action === 'remove') {
				const session = await this.builderService.removeLeg(
					userId,
					guildId,
					payload.index,
				)
				return interaction.editReply(
					this.builderService.render(session),
				)
			}
			const reservation = await this.builderService.reserveForPlacement(
				userId,
				guildId,
			)
			if (!reservation) {
				throw new Error(
					'Your parlay is already being placed. Please wait for the result.',
				)
			}
			const { session, token } = reservation
			try {
				this.builderService.validateForPlacement(session)
				const initialized = await this.parlayApi.init({
					legs: session.legs.map(({ event_id, outcome_uuid }) => ({
						event_id,
						outcome_uuid,
					})),
					stake: session.stake!,
					guild_id: guildId,
					user_id: userId,
				})
				const placed = await this.parlayApi.place(
					initialized.init_token,
				)
				await new BetslipManager(
					new BetslipWrapper(),
					new BetsCacheService(new CacheManager()),
				).announceParlayPlaced(interaction, {
					parlayId: placed.id,
					legCount: placed.leg_count,
					stake: Number(placed.stake),
					potentialPayout: Number(placed.potential_payout),
				})
				await this.builderService.clear(userId, guildId)
				await this.builderService.releasePlacement(
					userId,
					guildId,
					token,
				)
				return interaction.editReply(
					this.builderService.renderMessage(
						`## ✅ Parlay placed\n**${placed.leg_count} legs** • **$${Number(placed.stake).toFixed(2)}** at **${placed.combined_odds_american > 0 ? '+' : ''}${placed.combined_odds_american}**\nPotential payout: **$${Number(placed.potential_payout).toFixed(2)}**\nParlay ID: \`${placed.id}\``,
						0x57f287,
					),
				)
			} catch (error) {
				await this.builderService.releasePlacement(
					userId,
					guildId,
					token,
				)
				throw error
			}
		} catch (error) {
			logParlayBuilderError(error, { action: payload.action, userId })
			const message = getParlayErrorMessage(error)
			return interaction.editReply({
				...this.builderService.renderMessage(message),
				flags: MessageFlags.IsComponentsV2,
			})
		}
	}

	private async buildAddLegModal(): Promise<ModalBuilder> {
		const matches = ((await this.matchCache.getMatches()) ?? [])
			.filter((match) => match.id && match.home_team && match.away_team)
			.filter(
				(match) =>
					!match.commence_time ||
					new Date(match.commence_time).getTime() > Date.now(),
			)
			.slice(0, 25)
		if (matches.length === 0)
			throw new Error('No upcoming games are available right now.')
		const gameSelect = new StringSelectMenuBuilder()
			.setCustomId('parlay_game')
			.setPlaceholder('Choose an upcoming game')
			.setRequired(true)
			.addOptions(
				matches.map((match) => ({
					label: `${match.away_team} @ ${match.home_team}`.slice(
						0,
						100,
					),
					value: match.id!,
					description: match.commence_time
						? new Date(match.commence_time).toLocaleString(
								'en-US',
								{
									month: 'short',
									day: 'numeric',
									hour: 'numeric',
									minute: '2-digit',
								},
							)
						: 'Start time TBD',
				})),
			)
		return new ModalBuilder()
			.setCustomId('parlay_modal_add_leg')
			.setTitle('Add a parlay leg')
			.addLabelComponents(
				new LabelBuilder()
					.setLabel('Game')
					.setDescription('Choose an upcoming game')
					.setStringSelectMenuComponent(gameSelect),
			)
			.addLabelComponents(
				new LabelBuilder()
					.setLabel('Market')
					.setStringSelectMenuComponent(
						new StringSelectMenuBuilder()
							.setCustomId('parlay_market')
							.setPlaceholder('Choose market')
							.addOptions(
								{ label: 'Moneyline', value: 'h2h' },
								{ label: 'Spread', value: 'spreads' },
								{ label: 'Total', value: 'totals' },
							)
							.setRequired(true),
					),
			)
			.addLabelComponents(
				new LabelBuilder()
					.setLabel('Side')
					.setStringSelectMenuComponent(
						new StringSelectMenuBuilder()
							.setCustomId('parlay_side')
							.setPlaceholder('Choose side')
							.addOptions(
								{ label: 'Home team', value: 'home' },
								{ label: 'Away team', value: 'away' },
								{ label: 'Over', value: 'over' },
								{ label: 'Under', value: 'under' },
							)
							.setRequired(true),
					),
			)
	}

	private buildStakeModal(): ModalBuilder {
		return new ModalBuilder()
			.setCustomId('parlay_modal_stake')
			.setTitle('Set parlay stake')
			.addLabelComponents(
				new LabelBuilder()
					.setLabel('Stake (whole dollars)')
					.setTextInputComponent(
						new TextInputBuilder()
							.setCustomId('parlay_stake')
							.setStyle(TextInputStyle.Short)
							.setPlaceholder('10')
							.setRequired(true)
							.setMinLength(1)
							.setMaxLength(6),
					),
			)
	}
}
