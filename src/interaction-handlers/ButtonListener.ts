import {
	InteractionHandler,
	InteractionHandlerTypes,
} from "@sapphire/framework";
import type { ButtonInteraction } from "discord.js";
import { EmbedBuilder } from "discord.js";
import { BetslipManager } from "../utils/api/Khronos/bets/BetslipsManager.js";
import { btnIds } from "../lib/interfaces/interaction-handlers/interaction-handlers.interface.js";
import { BetsCacheService } from "../utils/api/common/bets/BetsCacheService.js";
import { CacheManager } from "../utils/cache/RedisCacheManager.js";
import MatchCacheService from "../utils/api/routes/cache/MatchCacheService.js";
import BetslipWrapper from "../utils/api/Khronos/bets/betslip-wrapper.js";
import MatchApiWrapper from "../utils/api/Khronos/matches/matchApiWrapper.js";
import { Match } from "@kh-openapi/index.js";
import { ErrorEmbeds } from "../utils/common/errors/global.js";
import embedColors from "../lib/colorsConfig.js";
import { patreonFooter } from "../utils/api/patreon/interfaces.js";
import PredictionApiWrapper from "../utils/api/Khronos/prediction/predictionApiWrapper.js";
import PropsApiWrapper from "../utils/api/Khronos/props/propsApiWrapper.js";
import {
	parsePropButtonId,
	PropButtons,
} from "../lib/interfaces/props/prop-buttons.interface.js";

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
		// Blanket Clearing Action Components
		const allBtnIds = [
			...Object.values(btnIds),
			PropButtons.OVER,
			PropButtons.UNDER,
		];
		if (!allBtnIds.some((id) => interaction.customId.startsWith(id))) {
			await interaction.update({
				components: [],
			});
			return this.none();
		}

		if (interaction.customId === `matchup_btn_cancel`) {
			await interaction.update({
				components: [],
			});

			return this.some();
		}

		if (interaction.customId === `matchup_btn_confirm`) {
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
						message: "Cached bet not found",
						data: {
							userId: interaction.user.id,
						},
					});
					const errMsg = `Unable to locate your bet data.`;
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
							message: "Match not found after API fetch",
							data: {
								matchup_id: matchId,
							},
						});
						return this.some({
							hasFailed: true,
							errMsg: `Unable to locate match data.`,
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
				const errMsg = `An error occurred when collecting betslip or match data.`;
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

		const parsedPropButton = parsePropButtonId(interaction.customId);
		if (parsedPropButton) {
			await interaction.deferReply({ ephemeral: true });
			return this.some(parsedPropButton);
		}

		return this.none();
	}

	public async run(interaction: ButtonInteraction, payload: any) {
		if (payload?.hasFailed) {
			const errMsg = payload.errMsg;
			await interaction.editReply({
				embeds: [ErrorEmbeds.internalErr(errMsg)],
				components: [],
			});
		}
		if (interaction.customId === btnIds.matchup_btn_cancel) {
			const betslipWrapper = new BetslipWrapper();
			await betslipWrapper.clearPending(interaction.user.id);
			const cancelEmbed = new EmbedBuilder()
				.setTitle("Bet Canceled")
				.setDescription(`Your bet has been successfully cancelled.`)
				.setColor(embedColors.PlutoRed)
				.setThumbnail(interaction.user.displayAvatarURL())
				.setFooter(patreonFooter);
			await interaction.editReply({
				embeds: [cancelEmbed],
				components: [],
			});
		} else if (interaction.customId === btnIds.matchup_btn_confirm) {
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
		} else if (payload.action === "over" || payload.action === "under") {
			const predictionApi = new PredictionApiWrapper();
			const propsApi = new PropsApiWrapper();

			try {
				const prop = await propsApi.getPropById(payload.propId);
				if (!prop) {
					throw new Error("Prop not found");
				}

				await predictionApi.createPrediction({
					user_id: interaction.user.id,
					prop_id: payload.propId,
					choice: payload.action === PropButtons.OVER ? "over" : "under",
					status: "pending",
					guild_id: interaction.guildId!,
					market_key: prop.market_key,
				});

				await interaction.editReply({
					content: `Your prediction has been stored (${payload.action}`,
				});

				// Delete the ephemeral message after 5 seconds
				setTimeout(() => {
					interaction.deleteReply().catch(console.error);
				}, 5000);
			} catch (error: any) {
				console.error("Error storing prediction:", error);
				await interaction.editReply({
					content: `${error?.message || "There was an error storing your prediction."}`,
				});
			}
		} else {
			return;
		}
	}
}
