import { ApiModules } from '../lib/interfaces/api/api.interface.js';
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
import { ApiErrorHandler } from '../utils/api/Khronos/error-handling/ApiErrorHandler.js';

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

			try {
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
					} catch (error: unknown) {
						return new ApiErrorHandler().handle(
							interaction,
							error,
							ApiModules.predictions,
						);
					}
				} else {
					// ? Creating a prediction
					// NOTE: Must sanitize the choice
					// Restore the space - replace _
					const sanitizedChoice = payload.action.replace(/_/g, ' ');

					await predictionApi.createPrediction({
						createPredictionDto: {
							user_id: interaction.user.id,
							prop_id: payload.propId,
							choice: sanitizedChoice,
							status: 'pending',
							guild_id: interaction.guildId!,
						},
					});

					const predictionEmbed = new EmbedBuilder()
						.setColor(embedColors.PlutoGreen)
						.setTitle('Prediction Stored')
						.setDescription(
							'Your prediction has been recorded.\nView your predictions with `/history`',
						)
						.addFields({
							name: 'Prediction',
							value: `\`${_.startCase(sanitizedChoice)}\``,
							inline: true,
						})
						.setTimestamp();

					await interaction.editReply({
						content: '',
						embeds: [predictionEmbed],
					});

					// Delete the ephemeral message after 10 seconds
					setTimeout(() => {
						interaction.deleteReply().catch(console.error);
					}, 10000);
				}
			} catch (error: unknown) {
				console.error({
					method: this.constructor.name,
					message: 'Error occured regarding predictions',
					data: {
						error,
					},
				});
				// ? NOTE: Embed titles may say 'Prediction Error' - but since this is catch-all scope, it could be prop related as well.
				return new ApiErrorHandler().handle(
					interaction,
					error,
					ApiModules.predictions,
				);
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
