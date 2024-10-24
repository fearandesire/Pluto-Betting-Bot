import {
	InteractionHandler,
	InteractionHandlerTypes,
	none,
	some,
} from '@sapphire/framework';
// pnpm issue with @sapphire framework
import { None, Option, Result } from '@sapphire/framework';
import type { ButtonInteraction } from 'discord.js';
import { EmbedBuilder } from 'discord.js';
import embedColors from '../lib/colorsConfig.js';
import {
	btnIds,
	startsWithAny,
} from '../lib/interfaces/interaction-handlers/interaction-handlers.interface.js';
import {
	type ParsedPropButton,
	parsePropButtonId,
	PropButtons,
} from '../lib/interfaces/props/prop-buttons.interface.js';
import type { Match } from '../openapi/khronos/models/Match.js';
import { BetslipManager } from '../utils/api/Khronos/bets/BetslipsManager.js';
import BetslipWrapper from '../utils/api/Khronos/bets/betslip-wrapper.js';
import MatchApiWrapper from '../utils/api/Khronos/matches/matchApiWrapper.js';
import PredictionApiWrapper from '../utils/api/Khronos/prediction/predictionApiWrapper.js';
import PropsApiWrapper from '../utils/api/Khronos/props/propsApiWrapper.js';
import { BetsCacheService } from '../utils/api/common/bets/BetsCacheService.js';
import { patreonFooter } from '../utils/api/patreon/interfaces.js';
import MatchCacheService from '../utils/api/routes/cache/MatchCacheService.js';
import { CacheManager } from '../utils/cache/RedisCacheManager.js';
import { ErrorEmbeds } from '../utils/common/errors/global.js';
import type { ICreateBetslipFull } from '../lib/interfaces/api/bets/betslips.interfaces.js';
import _ from 'lodash';

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
		});
	}

	/**
	 * @summary Button Event Listener - collects & parses necessary data before processing
	 *
	 * Bet Handling:
	 * - 'Confirm Bet' - Collects data for the bet and matchup in cache
	 *   - Passes data to run > BetslipManager.placeBet
	 * @param interaction
	 */
	// @ts-ignore - Weird TS Error
	public override async parse(interaction: ButtonInteraction) {
		// Define valid button ID prefixes
		const validPrefixes = ['prop_', 'matchup'];

		// Check if the button's custom ID starts with any valid prefix
		if (!startsWithAny(interaction.customId, validPrefixes)) {
			// Clear action components for invalid button IDs
			await interaction.update({
				components: [],
			});
			return this.none();
		}

		// ? Handle prop buttons
		if (_.startsWith(interaction.customId, 'prop_')) {
			await interaction.deferReply({ ephemeral: true });
			// ? Parse the prop button pressed for data / action
			const parsedButton = parsePropButtonId(interaction.customId);
			return parsedButton ? this.some(parsedButton) : this.none();
		}

		// Handle matchup buttons
		if (_.startsWith(interaction.customId, 'matchup')) {
			// Cancel button
			if (interaction.customId === btnIds.matchup_btn_cancel) {
				await interaction.update({
					components: [],
				});
				return this.some({
					hasFailed: false,
				});
			}

			// Confirm button
			if (interaction.customId === btnIds.matchup_btn_confirm) {
				await interaction.deferUpdate();
				await interaction.editReply({
					components: [],
				});
				try {
					const cachedBet = await new BetsCacheService(
						new CacheManager(),
					).getUserBet(interaction.user.id);
					if (!cachedBet) {
						console.error({
							method: this.constructor.name,
							message: 'Cached bet not found',
							data: {
								userId: interaction.user.id,
							},
						});
						const errMsg = 'Unable to locate your bet data.';
						return this.some({
							hasFailed: true,
							errMsg: errMsg,
						});
					}
					const matchId = cachedBet.match.id;
					let locatedMatch: Match | null = await new MatchCacheService(
						new CacheManager(),
					).getMatch(matchId);

					// If the match is not found in cache, attempt to locate it via API
					if (!locatedMatch) {
						const matchesApi = new MatchApiWrapper();
						const { matches } = await matchesApi.getAllMatches();
						locatedMatch =
							matches.find((match: Match) => match.id === matchId) ?? null;

						if (!locatedMatch) {
							console.error({
								method: this.constructor.name,
								message: 'Match not found after API fetch',
								data: {
									matchup_id: matchId,
								},
							});
							return this.some({
								hasFailed: true,
								errMsg: 'Unable to locate match data.',
							});
						}
					}
					// Continue processing with the found match
					const matchDetails = locatedMatch;
					return this.some({
						betslip: cachedBet,
						matchData: matchDetails,
					});
				} catch (error) {
					const errMsg =
						'An error occurred when collecting betslip or match data.';
					console.error({
						trace: this.constructor.name,
						message: errMsg,
						data: {
							error,
						},
					});
					return this.some({
						hasFailed: true,
						errMsg: errMsg,
					});
				}
			}
		}

		// If we reach here, it means we didn't handle the button
		return this.none();
	}

	public async run(interaction: ButtonInteraction, payload: ButtonPayload) {
		if ('hasFailed' in payload && payload.hasFailed) {
			const errMsg = payload.errMsg;
			await interaction.editReply({
				embeds: [ErrorEmbeds.internalErr(errMsg)],
				components: [],
			});
			return;
		}

		// ? Handle Cancelling A Betslip
		if (interaction.customId === btnIds.matchup_btn_cancel) {
			const betslipWrapper = new BetslipWrapper();
			await betslipWrapper.clearPending(interaction.user.id);
			const cancelEmbed = new EmbedBuilder()
				.setTitle('Bet Canceled')
				.setDescription('Your bet has been successfully cancelled.')
				.setColor(embedColors.PlutoRed)
				.setThumbnail(interaction.user.displayAvatarURL())
				.setFooter(patreonFooter);
			await interaction.editReply({
				embeds: [cancelEmbed],
				components: [],
			});
		}
		// ? Handle Confirming A Betslip
		else if (interaction.customId === btnIds.matchup_btn_confirm) {
			if ('betslip' in payload && 'matchData' in payload) {
				const { betslip, matchData } = payload;
				const matchOpponent = betslip.opponent;

				const { dateofmatchup } = matchData;
				const sanitizedBetslip = await new BetsCacheService(
					new CacheManager(),
				).sanitize(betslip);
				return new BetslipManager(
					new BetslipWrapper(),
					new BetsCacheService(new CacheManager()),
				).placeBet(interaction, sanitizedBetslip, {
					dateofmatchup,
					opponent: matchOpponent,
				});
			}
		} else if ('action' in payload) {
			// ? Handle A Prediction
			const predictionApi = new PredictionApiWrapper();
			const propsApi = new PropsApiWrapper();

			try {
				const prop = await propsApi.getPropById(payload.propId);
				if (!prop) {
					throw new Error('Prop not found');
				}

				// ? Prioritize handling a cancel
				if (payload.action.toLowerCase() === 'cancel') {
					try {
						await predictionApi.deletePrediction({
							userId: interaction.user.id,
							id: payload.propId,
						});
						return interaction.editReply({
							content: 'Your prediction has been cancelled.',
						});
					} catch (error: any) {
						// Identify type of err
						if (error?.response) {
							return interaction.editReply({
								content: 'You have not made a prediction on this prop yet.',
							});
						}
					}
				} else {
					await predictionApi.createPrediction({
						user_id: interaction.user.id,
						prop_id: payload.propId,
						choice: payload.action,
						status: 'pending',
						guild_id: interaction.guildId!,
						market_key: prop.market_key,
					});

					await interaction.editReply({
						content: `Your prediction has been stored.\nPrediction: ${payload.action}`,
					});

					// Delete the ephemeral message after 5 seconds
					setTimeout(() => {
						interaction.deleteReply().catch(console.error);
					}, 5000);
				}
			} catch (error) {
				await interaction.editReply({
					content:
						error instanceof Error
							? error.message
							: 'There was an error storing your prediction.',
				});
			}
		}
	}
}

interface FailedPayload {
	hasFailed: true;
	errMsg: string;
}

interface ConfirmPayload {
	betslip: ICreateBetslipFull;
	matchData: Match;
}

interface PropPayload extends ParsedPropButton {
	action: 'over' | 'under' | 'cancel';
}

type ButtonPayload = FailedPayload | ConfirmPayload | PropPayload;
