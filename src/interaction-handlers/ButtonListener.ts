import {
  InteractionHandler,
  InteractionHandlerTypes,
} from "@sapphire/framework";
import type { ButtonInteraction } from "discord.js";
import { EmbedBuilder } from "discord.js";
import _ from "lodash";
import embedColors from "../lib/colorsConfig.js";
import { ApiModules } from "../lib/interfaces/api/api.interface.js";
import type { ICreateBetslipFull } from "../lib/interfaces/api/bets/betslips.interfaces.js";
import { btnIds } from "../lib/interfaces/interaction-handlers/interaction-handlers.interface.js";
import {
  type ParsedPropButton,
  parsePropButtonId,
} from "../lib/interfaces/props/prop-buttons.interface.js";
import type { Match } from "../openapi/khronos/models/Match.js";
import { BetslipManager } from "../utils/api/Khronos/bets/BetslipsManager.js";
import BetslipWrapper from "../utils/api/Khronos/bets/betslip-wrapper.js";
import { ApiErrorHandler } from "../utils/api/Khronos/error-handling/ApiErrorHandler.js";
import MatchApiWrapper from "../utils/api/Khronos/matches/matchApiWrapper.js";
import PredictionApiWrapper from "../utils/api/Khronos/prediction/predictionApiWrapper.js";
import PropsApiWrapper from "../utils/api/Khronos/props/propsApiWrapper.js";
import { BetsCacheService } from "../utils/api/common/bets/BetsCacheService.js";
import { MarketKeyAbbreviations } from "../utils/api/common/interfaces/market-abbreviations.js";
import { patreonFooter } from "../utils/api/patreon/interfaces.js";
import MatchCacheService from "../utils/api/routes/cache/MatchCacheService.js";
import { CacheManager } from "../utils/cache/cache-manager.js";
import { DateManager } from "../utils/common/DateManager.js";
import TeamInfo from "../utils/common/TeamInfo.js";
import { ErrorEmbeds } from "../utils/common/errors/global.js";

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
    if (_.startsWith(interaction.customId, "prop_")) {
      await interaction.deferReply({ ephemeral: true });
      // ? Parse the prop button pressed for data / action
      const parsedButton = parsePropButtonId(interaction.customId);
      return parsedButton ? this.some(parsedButton) : this.none();
    }

    // Handle matchup buttons
    if (_.startsWith(interaction.customId, "matchup")) {
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
              message: "Cached bet not found",
              data: {
                userId: interaction.user.id,
              },
            });
            const errMsg = "Unable to locate your bet data.";
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
                errMsg: "Unable to locate match data.",
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
            "An error occurred when collecting betslip or match data.";
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
    if ("hasFailed" in payload && payload.hasFailed) {
      const errMsg = payload.errMsg;
      await interaction.editReply({
        embeds: [await ErrorEmbeds.internalErr(errMsg)],
        components: [],
      });
      return;
    }

    // ? Handle Cancelling A Betslip
    if (interaction.customId === btnIds.matchup_btn_cancel) {
      const betslipWrapper = new BetslipWrapper();
      await betslipWrapper.clearPending(interaction.user.id);
      const cancelEmbed = new EmbedBuilder()
        .setTitle("Bet Canceled")
        .setDescription("Your bet has been successfully cancelled.")
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
      if ("betslip" in payload && "matchData" in payload) {
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
    } else if ("action" in payload) {
      // ? Handle A Prediction
      const predictionApi = new PredictionApiWrapper();

      try {
        // ? Prioritize handling a cancel
        if (payload.action.toLowerCase() === "cancel") {
          try {
            await predictionApi.deletePrediction({
              userId: interaction.user.id,
              id: payload.propId,
            });
            return interaction.editReply({
              content: "Your prediction has been cancelled.",
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
          const sanitizedChoice = payload.action.replace(/_/g, " ");

          // Fetch prop to get sport information and outcomes
          const propsApi = new PropsApiWrapper();
          const prop = await propsApi.getPropByUuid(payload.propId);

          // Find the matching outcome based on the user's choice
          // Match by: outcome_uuid (primary), name, or description
          const matchedOutcome = prop.outcomes.find(
            (outcome) =>
              outcome.outcome_uuid === payload.propId ||
              outcome.name.toLowerCase() === sanitizedChoice.toLowerCase() ||
              (outcome.description &&
                outcome.description.toLowerCase() ===
                  sanitizedChoice.toLowerCase()),
          );

          if (!matchedOutcome) {
            console.error({
              method: this.constructor.name,
              message: "Could not find matching outcome for user's choice",
              data: {
                propId: payload.propId,
                sanitizedChoice,
                availableOutcomes: prop.outcomes.map((o) => o.name),
              },
            });
            return interaction.editReply({
              content:
                "An error occurred while processing your prediction. Please try again.",
            });
          }

          await predictionApi.createPrediction({
            createPredictionDto: {
              user_id: interaction.user.id,
              outcome_uuid: matchedOutcome.outcome_uuid,
              choice: sanitizedChoice,
              status: "pending",
              guild_id: interaction.guildId!,
              sport: prop.event_context.sport_title,
            },
          });

          // Format the choice with point and market from the matched outcome
          const formattedChoice = this.formatPredictionChoice(
            sanitizedChoice,
            matchedOutcome.point,
            prop.market_key,
            matchedOutcome.description,
          );

          // Format match string
          const matchString = await this.formatMatchString(
            prop.event_context.away_team,
            prop.event_context.home_team,
          );

          // Format date
          const formattedDate = new DateManager().toMMDDYYYY(
            prop.event_context.commence_time,
          );

          // For spreads, use market name as the prop description
          const propDescription =
            prop.market_key === "spreads"
              ? "Point Spread"
              : matchedOutcome.description;

          const predictionEmbed = new EmbedBuilder()
            .setColor(embedColors.PlutoGreen)
            .setTitle("Prediction Placed")
            .setDescription(
              "Your prediction has been recorded.\nView your predictions with `/history`",
            )
            .addFields(
              {
                name: "Prop Details",
                value: propDescription
                  ? `**Prop:** ${propDescription}\n**Choice:** ${formattedChoice}`
                  : `**Choice:** ${formattedChoice}`,
                inline: false,
              },
              {
                name: "Event Details",
                value: `**Match:** ${matchString}\n**Date:** ${formattedDate}`,
                inline: false,
              },
            )
            .setTimestamp();

          await interaction.editReply({
            content: "",
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
          message: "Error occured regarding predictions",
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

  /**
   * Formats a prediction choice with point and market information
   * @param choice - The user's choice (e.g., "over", "under", "philadelphia eagles")
   * @param point - The point value (e.g., 15.5, -7.0)
   * @param marketKey - The market key (e.g., "player_reception_yds", "spreads")
   * @param description - Optional prop description
   * @returns Formatted choice string (e.g., "OVER 15.5 Reception Yards", "Philadelphia Eagles -7.0")
   */
  private formatPredictionChoice(
    choice: string,
    point: number | undefined,
    marketKey: string,
    description?: string,
  ): string {
    // Handle spreads market specially - choice is team name
    if (marketKey === "spreads") {
      if (point !== undefined && point !== null) {
        const spreadDisplay = point > 0 ? `+${point}` : point;
        return `${_.startCase(choice)} ${spreadDisplay}`;
      }
      return _.startCase(choice);
    }

    // Standard handling for other markets (over/under, yes/no)
    const upperChoice = choice.toUpperCase();
    const abbreviation = MarketKeyAbbreviations[marketKey];
    let marketName = abbreviation
      ? _.startCase(marketKey.replace("player_", ""))
      : _.startCase(marketKey);

    if (point) {
      return `${upperChoice} ${point} ${marketName}`;
    }

    return `${upperChoice} ${marketName}`;
  }

  /**
   * Formats the match string with team identifiers
   * @param awayTeam - Away team name
   * @param homeTeam - Home team name
   * @returns Formatted match string (e.g., "LAL vs. BOS")
   */
  private async formatMatchString(
    awayTeam: string,
    homeTeam: string,
  ): Promise<string> {
    const result = await TeamInfo.resolveTeamIdentifier({
      away_team: awayTeam,
      home_team: homeTeam,
    });
    return `${result.away_team} vs. ${result.home_team}`;
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
  action: "over" | "under" | "cancel";
}

type ButtonPayload = FailedPayload | ConfirmPayload | PropPayload;
