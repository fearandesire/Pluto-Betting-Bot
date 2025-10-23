import { PaginatedMessageEmbedFields } from "@sapphire/discord.js-utilities";
import { container } from "@sapphire/framework";
import type { Subcommand } from "@sapphire/plugin-subcommands";
import { EmbedBuilder } from "discord.js";
import _ from "lodash";
import embedColors from "../../lib/colorsConfig.js";
import type { AllUserPredictionsDto } from "../../openapi/khronos/models/AllUserPredictionsDto.js";
import PredictionApiWrapper from "../api/Khronos/prediction/predictionApiWrapper.js";
import PropsApiWrapper from "../api/Khronos/props/propsApiWrapper.js";
import { DateManager } from "../common/DateManager.js";
import TeamInfo from "../common/TeamInfo.js";

/**
 * Handler for admin prediction management commands
 * Handles viewing and deleting user predictions
 */
export class AdminPredictionsHandler {
  /**
   * Handle /admin predictions view <user>
   * View all active predictions for a specific user
   */
  public async handleView(
    interaction: Subcommand.ChatInputCommandInteraction,
  ): Promise<void> {
    await interaction.deferReply();

    const user = interaction.options.getUser("user", true);

    try {
      const predictionApiWrapper = new PredictionApiWrapper();
      const activePredictions =
        await predictionApiWrapper.getActivePredictionsForUser({
          userId: user.id,
        });

      if (!activePredictions || activePredictions.length === 0) {
        await interaction.editReply({
          content: `No active predictions found for ${user.username}.`,
        });
        return;
      }

      const templateEmbed = new EmbedBuilder()
        .setTitle(`Active Predictions | ${user.username}`)
        .setDescription(
          `Total: \`${activePredictions.length}\` active prediction(s)`,
        )
        .setColor(embedColors.PlutoBlue)
        .setFooter({ text: `User ID: ${user.id}` });

      const formattedPredictions = await Promise.all(
        activePredictions.map((prediction) =>
          this.createPredictionField(prediction),
        ),
      );

      const paginatedMsg = new PaginatedMessageEmbedFields({
        template: { embeds: [templateEmbed] },
      })
        .setItems(formattedPredictions)
        .setItemsPerPage(5)
        .make();

      await paginatedMsg.run(interaction);
    } catch (error) {
      container.logger.error("Error viewing predictions:", error);
      await interaction.editReply({
        content: "An error occurred while fetching predictions.",
      });
    }
  }

  /**
   * Handle /admin predictions delete <user> <prediction_id>
   * Delete a specific prediction for a user
   */
  public async handleDelete(
    interaction: Subcommand.ChatInputCommandInteraction,
  ): Promise<void> {
    await interaction.deferReply();

    const user = interaction.options.getUser("user", true);
    const predictionIdInput = interaction.options.getString(
      "prediction_id",
      true,
    );

    try {
      const predictionApiWrapper = new PredictionApiWrapper();

      // Get all active predictions for the user to find the full UUID
      const activePredictions =
        await predictionApiWrapper.getActivePredictionsForUser({
          userId: user.id,
        });

      if (!activePredictions || activePredictions.length === 0) {
        await interaction.editReply({
          content: `No active predictions found for ${user.username}.`,
        });
        return;
      }

      // Find the prediction that matches the input (support both full UUID and last 8 chars)
      const matchedPrediction = activePredictions.find(
        (pred) =>
          pred.id === predictionIdInput ||
          pred.id.slice(-8).toLowerCase() === predictionIdInput.toLowerCase(),
      );

      if (!matchedPrediction) {
        const availableIds = activePredictions
          .map((pred) => `\`${pred.id.slice(-8)}\``)
          .join(", ");
        await interaction.editReply({
          content: `Prediction ID \`${predictionIdInput}\` not found for ${user.username}.\nAvailable IDs: ${availableIds}`,
        });
        return;
      }

      // Delete the prediction
      await predictionApiWrapper.deletePredictionById({
        predictionId: matchedPrediction.id,
        userId: user.id,
      });

      // Format the prediction details for confirmation
      const parsedMatchString = await this.parseMatchString(
        matchedPrediction.match_string,
      );
      const date = new DateManager().toMMDDYYYY(matchedPrediction.created_at);

      const confirmEmbed = new EmbedBuilder()
        .setTitle("✅ Prediction Deleted")
        .setColor(embedColors.success)
        .setDescription(`Successfully deleted prediction for ${user.username}.`)
        .addFields(
          {
            name: "Prediction ID",
            value: `\`${matchedPrediction.id.slice(-8)}\``,
            inline: true,
          },
          {
            name: "User",
            value: `${user.username} (${user.id})`,
            inline: true,
          },
          {
            name: "Match",
            value: parsedMatchString,
            inline: false,
          },
          {
            name: "Choice",
            value: matchedPrediction.choice,
            inline: true,
          },
          {
            name: "Created",
            value: date,
            inline: true,
          },
        )
        .setTimestamp();

      await interaction.editReply({
        embeds: [confirmEmbed],
      });
    } catch (error: any) {
      container.logger.error("Error deleting prediction:", error);

      // Handle specific errors from the API
      if (error.response?.status === 404) {
        await interaction.editReply({
          content: "Prediction not found or doesn't belong to this user.",
        });
        return;
      }
      if (error.response?.status === 400) {
        await interaction.editReply({
          content:
            "Cannot delete this prediction. The event may have already started or the prediction has been processed.",
        });
        return;
      }

      await interaction.editReply({
        content: "An error occurred while deleting the prediction.",
      });
    }
  }

  /**
   * Create a formatted field for a prediction
   */
  private async createPredictionField(
    prediction: AllUserPredictionsDto,
  ): Promise<{ name: string; value: string; inline: boolean }> {
    const parsedMatchString = await this.parseMatchString(
      prediction.match_string,
    );

    // Get Prop via ID within the prediction
    const propApiWrapper = new PropsApiWrapper();
    const prop = await propApiWrapper.getPropByUuid(prediction.outcome_uuid);

    // Find the specific outcome that matches the prediction
    const outcome = prop.outcomes.find(
      (o) => o.outcome_uuid === prediction.outcome_uuid,
    );

    // Format the choice with point and market
    const formattedChoice = this.formatPredictionChoice(
      prediction.choice,
      outcome?.point,
      prop.market_key,
    );

    // Format date
    const date = new DateManager().toMMDDYYYY(prediction.created_at);

    // Build Prop Details section
    let propDetailsValue = `**Choice:** ${formattedChoice}`;
    if (outcome?.description && outcome.description.trim() !== "") {
      propDetailsValue = `**Prop:** ${outcome.description}\n${propDetailsValue}`;
    }

    // Build Event Details section
    const eventDetailsValue = `**Match:** ${parsedMatchString}\n**Date:** ${date}`;

    // Combine sections
    const value = `**ID:** \`${prediction.id.slice(-8)}\`\n\n**Prop Details**\n${propDetailsValue}\n\n**Event Details**\n${eventDetailsValue}`;

    return {
      name: `Prediction #${prediction.id.slice(-8)}`,
      value: value,
      inline: false,
    };
  }

  /**
   * Formats a prediction choice with point and market information
   */
  private formatPredictionChoice(
    choice: string,
    point: number | undefined,
    marketKey: string,
  ): string {
    const upperChoice = choice.toUpperCase();
    let marketName = _.startCase(marketKey.replace("player_", ""));

    if (point) {
      return `${upperChoice} ${point} ${marketName}`;
    }

    return `${upperChoice} ${marketName}`;
  }

  /**
   * Parse and format match string with team identifiers
   */
  private async parseMatchString(matchString: string): Promise<string> {
    const [awayTeam, homeTeam] = matchString.split(" vs. ");
    const result = await TeamInfo.resolveTeamIdentifier({
      away_team: awayTeam,
      home_team: homeTeam,
    });

    return `${result.away_team} vs. ${result.home_team}`;
  }
}

