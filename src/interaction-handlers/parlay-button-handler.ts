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
	buildParlayModalId,
	getParlayErrorMessage,
	logParlayBuilderError,
	type ParlayBuilderIdentity,
	ParlayBuilderService,
	parseParlayButtonId,
	STALE_PARLAY_BUILDER_MESSAGE,
} from '../services/ParlayBuilderService.js'
import { BetsCacheService } from '../utils/api/common/bets/BetsCacheService.js'
import { BetslipManager } from '../utils/api/Khronos/bets/BetslipsManager.js'
import BetslipWrapper from '../utils/api/Khronos/bets/betslip-wrapper.js'
import ParlayApiWrapper, {
	type ParlayResponse,
} from '../utils/api/Khronos/parlays/ParlayApiWrapper.js'
import MatchCacheService from '../utils/api/routes/cache/match-cache-service.js'
import { CacheManager } from '../utils/cache/cache-manager.js'

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
		const control = parseParlayButtonId(interaction.customId)
		if (!control) {
			if (interaction.customId.startsWith('parlay_btn_')) {
				await interaction.reply({
					content: STALE_PARLAY_BUILDER_MESSAGE,
					flags: MessageFlags.Ephemeral,
				})
			}
			return this.none()
		}
		const identity = {
			sessionId: control.sessionId,
			revision: control.revision,
		}
		if (control.action === 'add' || control.action === 'stake') {
			try {
				if (!interaction.guildId) {
					throw new Error(
						'Parlays can only be built inside a server.',
					)
				}
				await this.builderService.assertCurrent(
					interaction.user.id,
					interaction.guildId,
					identity,
				)
				await interaction.showModal(
					control.action === 'add'
						? await this.buildAddLegModal(identity)
						: this.buildStakeModal(identity),
				)
			} catch (error) {
				logParlayBuilderError(error, {
					action: `open_${control.action}_modal`,
					userId: interaction.user.id,
				})
				await interaction.reply({
					content: getParlayErrorMessage(error),
					flags: MessageFlags.Ephemeral,
				})
			}
			return this.none()
		}
		if (control.action === 'remove') {
			await interaction.deferUpdate()
			return this.some({
				action: 'remove',
				index: control.index!,
				...identity,
			})
		}
		if (control.action === 'cancel') {
			await interaction.deferUpdate()
			return this.some({ action: 'cancel', ...identity })
		}
		if (control.action === 'confirm') {
			await interaction.deferUpdate()
			return this.some({ action: 'confirm', ...identity })
		}
		return this.none()
	}

	public async run(
		interaction: ButtonInteraction,
		payload:
			| ({ action: 'remove'; index: number } & ParlayBuilderIdentity)
			| ({ action: 'cancel' } & ParlayBuilderIdentity)
			| ({ action: 'confirm' } & ParlayBuilderIdentity),
	) {
		const userId = interaction.user.id
		const guildId = interaction.guildId
		const expected = {
			sessionId: payload.sessionId,
			revision: payload.revision,
		}
		let placementToken: string | undefined
		let leaseHeartbeat: NodeJS.Timeout | undefined
		try {
			if (!guildId) {
				throw new Error('Parlays can only be built inside a server.')
			}
			if (payload.action === 'cancel') {
				const session = await this.builderService.assertCurrent(
					userId,
					guildId,
					expected,
				)
				if (
					session.placementPhase === 'placing' ||
					session.placementPhase === 'unknown'
				) {
					const placed = await this.parlayApi.findByPlacement(
						session.placementId,
					)
					if (placed) {
						return this.finishPlacement(
							interaction,
							userId,
							guildId,
							expected,
							placed,
						)
					}
					if (session.placementPhase === 'placing') {
						throw new Error(
							'Your parlay placement is still being reconciled. Please wait for the result.',
						)
					}
					await this.builderService.setPlacementState(
						userId,
						guildId,
						expected,
						'editing',
					)
				}
				await this.builderService.clear(userId, guildId, expected)
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
					expected,
					payload.index,
				)
				return interaction.editReply(
					this.builderService.render(session),
				)
			}
			let current = await this.builderService.assertCurrent(
				userId,
				guildId,
				expected,
			)
			if (
				current.placementPhase === 'placed' &&
				current.lastPlacementResponse
			) {
				return this.finishPlacement(
					interaction,
					userId,
					guildId,
					expected,
					current.lastPlacementResponse,
				)
			}
			if (current.placementPhase === 'unknown') {
				const placed = await this.parlayApi.findByPlacement(
					current.placementId,
				)
				if (placed) {
					return this.finishPlacement(
						interaction,
						userId,
						guildId,
						expected,
						placed,
					)
				}
				current = await this.builderService.setPlacementState(
					userId,
					guildId,
					expected,
					'editing',
				)
			}
			if (current.placementPhase === 'placing') {
				throw new Error(
					'Your parlay is already being placed. Please wait for the result.',
				)
			}
			const reservation = await this.builderService.reserveForPlacement(
				userId,
				guildId,
				expected,
			)
			if (!reservation) {
				throw new Error(
					'Your parlay is already being placed. Please wait for the result.',
				)
			}
			const { session, token } = reservation
			placementToken = token
			let leaseLost = false
			const assertPlacementLease = async () => {
				if (leaseLost) {
					throw new Error(
						'Parlay placement lost its reservation. Please try again.',
					)
				}
				const refreshed = await this.builderService.refreshPlacement(
					userId,
					guildId,
					token,
				)
				if (!refreshed) {
					leaseLost = true
					throw new Error(
						'Parlay placement lost its reservation. Please try again.',
					)
				}
			}
			leaseHeartbeat = setInterval(() => {
				void assertPlacementLease().catch((error) =>
					logParlayBuilderError(error, {
						action: 'refresh_placement_reservation',
						userId,
					}),
				)
			}, 30_000)
			leaseHeartbeat.unref?.()
			let placementRequested = false
			try {
				await assertPlacementLease()
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
				await assertPlacementLease()
				placementRequested = true
				const placed = await this.parlayApi.place(
					initialized.init_token,
					session.placementId,
				)
				return this.finishPlacement(
					interaction,
					userId,
					guildId,
					expected,
					placed,
					token,
				)
			} catch (error) {
				if (!placementRequested) {
					await this.builderService.setPlacementState(
						userId,
						guildId,
						expected,
						'editing',
					)
					throw error
				}
				await this.builderService.setPlacementState(
					userId,
					guildId,
					expected,
					'unknown',
				)
				try {
					const placed = await this.parlayApi.findByPlacement(
						session.placementId,
					)
					if (placed) {
						return this.finishPlacement(
							interaction,
							userId,
							guildId,
							expected,
							placed,
							token,
						)
					}
				} catch (reconciliationError) {
					logParlayBuilderError(reconciliationError, {
						action: 'reconcile_placement',
						userId,
					})
					throw new Error(
						'Your parlay placement is still being reconciled. Do not confirm again yet.',
					)
				}
				await this.builderService.setPlacementState(
					userId,
					guildId,
					expected,
					'editing',
				)
				throw error
			} finally {
				clearInterval(leaseHeartbeat)
			}
		} catch (error) {
			logParlayBuilderError(error, { action: payload.action, userId })
			const message = getParlayErrorMessage(error)
			return interaction.editReply({
				...this.builderService.renderMessage(message),
				flags: MessageFlags.IsComponentsV2,
			})
		} finally {
			if (leaseHeartbeat) clearInterval(leaseHeartbeat)
			if (placementToken) {
				try {
					await this.builderService.releasePlacement(
						userId,
						guildId!,
						placementToken,
					)
				} catch (error) {
					logParlayBuilderError(error, {
						action: 'release_placement_reservation',
						userId,
					})
				}
			}
		}
	}

	private async finishPlacement(
		interaction: ButtonInteraction,
		userId: string,
		guildId: string,
		expected: ParlayBuilderIdentity,
		placed: ParlayResponse,
		placementToken?: string,
	) {
		try {
			await this.builderService.setPlacementState(
				userId,
				guildId,
				expected,
				'placed',
				placed,
			)
		} catch (error) {
			logParlayBuilderError(error, {
				action: 'persist_placed_parlay',
				userId,
			})
		}
		try {
			await new BetslipManager(
				new BetslipWrapper(),
				new BetsCacheService(new CacheManager()),
			).announceParlayPlaced(interaction, {
				parlayId: placed.id,
				legCount: placed.leg_count,
				stake: Number(placed.stake),
				potentialPayout: Number(placed.potential_payout),
			})
		} catch (error) {
			logParlayBuilderError(error, {
				action: 'announce_placed_parlay',
				userId,
			})
		}
		if (placementToken) {
			try {
				await this.builderService.clearWithPlacementToken(
					userId,
					guildId,
					placementToken,
				)
			} catch (error) {
				logParlayBuilderError(error, {
					action: 'clear_placed_parlay_builder',
					userId,
				})
			}
		}
		return interaction.editReply(
			this.builderService.renderMessage(
				`## ✅ Parlay placed\n**${placed.leg_count} legs** • **$${Number(placed.stake).toFixed(2)}** at **${placed.combined_odds_american > 0 ? '+' : ''}${placed.combined_odds_american}**\nPotential payout: **$${Number(placed.potential_payout).toFixed(2)}**\nParlay ID: \`${placed.id}\``,
				0x57f287,
			),
		)
	}

	private async buildAddLegModal(
		identity: ParlayBuilderIdentity,
	): Promise<ModalBuilder> {
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
			.setCustomId(buildParlayModalId(identity, 'add-leg'))
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

	private buildStakeModal(identity: ParlayBuilderIdentity): ModalBuilder {
		return new ModalBuilder()
			.setCustomId(buildParlayModalId(identity, 'stake'))
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
