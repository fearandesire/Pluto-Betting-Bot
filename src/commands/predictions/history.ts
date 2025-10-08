import { ApplyOptions } from "@sapphire/decorators";
import { PaginatedMessageEmbedFields } from "@sapphire/discord.js-utilities";
import { Command } from "@sapphire/framework";
import { EmbedBuilder, InteractionContextType } from "discord.js";
import type { User } from "discord.js";
import _ from "lodash";
import embedColors from "../../lib/colorsConfig.js";
import PredictionApiWrapper from "../../utils/api/Khronos/prediction/predictionApiWrapper.js";
import PropsApiWrapper from "../../utils/api/Khronos/props/propsApiWrapper.js";
import { MarketKeyAbbreviations } from "../../utils/api/common/interfaces/market-abbreviations.js";
import { DateManager } from "../../utils/common/DateManager.js";
import TeamInfo from "../../utils/common/TeamInfo.js";
import type { AllUserPredictionsDto } from "../../openapi/khronos/models/AllUserPredictionsDto.js";
import { GetAllPredictionsFilteredStatusEnum } from "../../openapi/khronos/apis/PredictionApi.js";

@ApplyOptions<Command.Options>({
  description: "View your prediction history",
})
export class UserCommand extends Command {
  public override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand(
      (builder) =>
        builder //
          .setName(this.name)
          .setDescription(this.description)
          .setContexts(InteractionContextType.Guild)
          .addUserOption((option) =>
            option
              .setName("user")
              .setDescription(
                "[Optional] The user to view history for (default: yourself)",
              )
              .setRequired(false),
          )
          .addStringOption((option) =>
            option
              .setName("status")
              .setDescription("[Optional] Filter predictions by status")
              .setRequired(false)
              .addChoices(
                {
                  name: "Pending",
                  value: GetAllPredictionsFilteredStatusEnum.Pending,
                },
                {
                  name: "Completed",
                  value: GetAllPredictionsFilteredStatusEnum.Completed,
                },
              ),
          ),
      { idHints: ["1298280482123026536"] },
    );
  }

  public override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    await interaction.deferReply();

    const user = interaction.options.getUser("user") || interaction.user;
    const status = interaction.options.getString(
      "status",
    ) as GetAllPredictionsFilteredStatusEnum | null;

    if (!user) {
      return interaction.editReply({
        content: "Invalid user specified.",
      });
    }

    try {
      const predictionApiWrapper = new PredictionApiWrapper();
      const usersPredictions = await predictionApiWrapper.getPredictionsForUser(
        {
          userId: user.id,
        },
      );

      if (!usersPredictions || usersPredictions.length === 0) {
        return interaction.editReply({
          content: "No predictions found for the specified criteria.",
        });
      }
      const descStr = status ? `Filtered by: \`${status}\`` : null;
      const templateEmbed = new EmbedBuilder()
        .setTitle(`Prediction History | ${user.username}`)
        .setDescription(descStr)
        .setColor(embedColors.PlutoBlue);

      const formattedPredictions = await Promise.all(
        usersPredictions.map((prediction) =>
          this.createPredictionField(prediction),
        ),
      );

      const paginatedMsg = new PaginatedMessageEmbedFields({
        template: { embeds: [templateEmbed] },
      })
        .setItems(formattedPredictions)
        .setItemsPerPage(10)
        .make();

      await paginatedMsg.run(interaction);
    } catch (error) {
      this.container.logger.error(error);
      return interaction.editReply({
        content: "An error occurred while fetching the prediction history.",
      });
    }
  }

  private async createHistoryEmbed(
    predictions: AllUserPredictionsDto[],
    user: User,
    currentPage: number,
    status: GetAllPredictionsFilteredStatusEnum | null,
  ): Promise<EmbedBuilder> {
    const startIndex = (currentPage - 1) * 10;
    const endIndex = startIndex + 10;
    const pageEntries = predictions.slice(startIndex, endIndex);
    const totalPages = Math.ceil(predictions.length / 10);

    const embed = new EmbedBuilder()
      .setTitle(`Prediction History for ${user.username}`)
      .setColor(embedColors.PlutoBlue)
      .setFooter({ text: `Page ${currentPage} of ${totalPages}` });

    const totalPredictions = predictions.length;
    let headerText = `Total predictions: \`${totalPredictions}\``;
    if (status) {
      headerText += ` | Filtered by: \`${status}\``;
    }

    embed.setDescription(headerText);

    for (const prediction of pageEntries) {
      const field = await this.createPredictionField(prediction);
      embed.addFields(field);
    }

    return embed;
  }

  private async createPredictionField(
    prediction: AllUserPredictionsDto,
  ): Promise<{ name: string; value: string; inline: boolean }> {
    const outcomeEmoji = this.getOutcomeEmoji(prediction);
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

    // Format outcome status
    const outcomeStr = (emoji: string) => {
      if (emoji === "⏳") {
        return "Pending ⏳";
      }
      if (emoji === "✅") {
        return "Correct ✅";
      }
      if (emoji === "❌") {
        return "Incorrect ❌";
      }
      return emoji;
    };

    // Build Prop Details section
    let propDetailsValue = `**Choice:** ${formattedChoice}`;
    if (prediction.description && prediction.description.trim() !== "") {
      propDetailsValue = `**Prop:** ${prediction.description}\n${propDetailsValue}`;
    }

    // Build Event Details section
    const eventDetailsValue = `**Match:** ${parsedMatchString}\n**Date:** ${date}`;

    // Combine sections with status
    const value = `**Status:** ${outcomeStr(outcomeEmoji)}\n\n**Prop Details**\n${propDetailsValue}\n\n**Event Details**\n${eventDetailsValue}`;

    return {
      name: `Prediction #${prediction.id.slice(-8)}`,
      value: value,
      inline: false,
    };
  }

  /**
   * Formats a prediction choice with point and market information
   * @param choice - The user's choice (e.g., "over", "under")
   * @param point - The point value (e.g., 15.5)
   * @param marketKey - The market key (e.g., "player_reception_yds")
   * @returns Formatted choice string (e.g., "OVER 15.5 Reception Yards")
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

  private getOutcomeEmoji(prediction: AllUserPredictionsDto): string {
    if (prediction.status !== GetAllPredictionsFilteredStatusEnum.Completed) {
      return "⏳";
    }
    if (prediction.is_correct === null) {
      return "⏳";
    }
    return prediction?.is_correct ? "✅" : "❌";
  }

  private async parseMatchString(matchString: string) {
    const [awayTeam, homeTeam] = matchString.split(" vs. ");
    const result = await TeamInfo.resolveTeamIdentifier({
      away_team: awayTeam,
      home_team: homeTeam,
    });

    return `${result.away_team} vs. ${result.home_team}`;
  }
  private parseChoice(choice: string) {
    return choice.charAt(0).toUpperCase() + choice.slice(1).toLowerCase();
  }
}
