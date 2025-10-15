import { ApplyOptions } from "@sapphire/decorators";
import { PaginatedMessageEmbedFields } from "@sapphire/discord.js-utilities";
import { Subcommand } from "@sapphire/plugin-subcommands";
import { EmbedBuilder, InteractionContextType } from "discord.js";
import _ from "lodash";
import embedColors from "../../lib/colorsConfig.js";
import { GetAllPredictionsFilteredStatusEnum } from "../../openapi/khronos/apis/PredictionApi.js";
import type { AllUserPredictionsDto } from "../../openapi/khronos/models/AllUserPredictionsDto.js";
import PredictionApiWrapper from "../../utils/api/Khronos/prediction/predictionApiWrapper.js";
import PropsApiWrapper from "../../utils/api/Khronos/props/propsApiWrapper.js";
import { DateManager } from "../../utils/common/DateManager.js";
import TeamInfo from "../../utils/common/TeamInfo.js";

/**
 * User-facing prediction command for viewing personal prediction history and stats
 */
@ApplyOptions<Subcommand.Options>({
  name: "predictions",
  description: "View your predictions",
  subcommands: [
    { name: "history", chatInputRun: "handleHistory" },
    { name: "stats", chatInputRun: "handleStats" },
  ],
})
export class UserCommand extends Subcommand {
  public override registerApplicationCommands(registry: Subcommand.Registry) {
    registry.registerChatInputCommand(
      (builder) =>
        builder
          .setName(this.name)
          .setDescription(this.description)
          .setContexts(InteractionContextType.Guild)
          .addSubcommand((subcommand) =>
            subcommand
              .setName("history")
              .setDescription("View your prediction history")
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
          )
          .addSubcommand((subcommand) =>
            subcommand
              .setName("stats")
              .setDescription("View your prediction statistics"),
          ),
      { idHints: ["1298280482123026536"] },
    );
  }

  /**
   * Handle /predictions history subcommand
   */
  public async handleHistory(
    interaction: Subcommand.ChatInputCommandInteraction,
  ) {
    await interaction.deferReply();

    const user = interaction.user;
    const status = interaction.options.getString(
      "status",
    ) as GetAllPredictionsFilteredStatusEnum | null;

    try {
      const predictionApiWrapper = new PredictionApiWrapper();
      const usersPredictions = await predictionApiWrapper.getPredictionsForUser(
        {
          userId: user.id,
        },
      );

      if (!usersPredictions || usersPredictions.length === 0) {
        return interaction.editReply({
          content: "You haven't made any predictions yet.",
        });
      }

      const descStr = status ? `Filtered by: \`${status}\`` : null;
      const templateEmbed = new EmbedBuilder()
        .setTitle("Your Prediction History")
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
        content: "An error occurred while fetching your prediction history.",
      });
    }
  }

  /**
   * Handle /predictions stats subcommand
   */
  public async handleStats(
    interaction: Subcommand.ChatInputCommandInteraction,
  ) {
    await interaction.deferReply();

    const user = interaction.user;

    try {
      const predictionApiWrapper = new PredictionApiWrapper();
      const usersPredictions = await predictionApiWrapper.getPredictionsForUser(
        {
          userId: user.id,
        },
      );

      if (!usersPredictions || usersPredictions.length === 0) {
        return interaction.editReply({
          content: "You haven't made any predictions yet.",
        });
      }

      // Calculate statistics
      const totalPredictions = usersPredictions.length;
      const completedPredictions = usersPredictions.filter(
        (p) => p.status === GetAllPredictionsFilteredStatusEnum.Completed,
      );
      const pendingPredictions = usersPredictions.filter(
        (p) => p.status === GetAllPredictionsFilteredStatusEnum.Pending,
      );

      const correctPredictions = completedPredictions.filter(
        (p) => p.is_correct === true,
      );
      const incorrectPredictions = completedPredictions.filter(
        (p) => p.is_correct === false,
      );

      const winRate =
        completedPredictions.length > 0
          ? (
              (correctPredictions.length / completedPredictions.length) *
              100
            ).toFixed(1)
          : "0.0";

      const embed = new EmbedBuilder()
        .setTitle(`📊 Prediction Statistics`)
        .setColor(embedColors.PlutoBlue)
        .setDescription(`Stats for ${user.username}`)
        .addFields(
          {
            name: "Total Predictions",
            value: `\`${totalPredictions}\``,
            inline: true,
          },
          {
            name: "Win Rate",
            value: `\`${winRate}%\``,
            inline: true,
          },
          { name: "\u200B", value: "\u200B", inline: true },
          {
            name: "✅ Correct",
            value: `\`${correctPredictions.length}\``,
            inline: true,
          },
          {
            name: "❌ Incorrect",
            value: `\`${incorrectPredictions.length}\``,
            inline: true,
          },
          {
            name: "⏳ Pending",
            value: `\`${pendingPredictions.length}\``,
            inline: true,
          },
        )
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    } catch (error) {
      this.container.logger.error(error);
      return interaction.editReply({
        content: "An error occurred while fetching your statistics.",
      });
    }
  }

  private async createPredictionField(
    prediction: AllUserPredictionsDto,
  ): Promise<{ name: string; value: string; inline: boolean }> {
    const outcomeEmoji = this.getOutcomeEmoji(prediction);
    const parsedMatchString = await this.parseMatchString(
      prediction.match_string,
    );

    const propApiWrapper = new PropsApiWrapper();
    const prop = await propApiWrapper.getPropByUuid(prediction.outcome_uuid);

    const outcome = prop.outcomes.find(
      (o) => o.outcome_uuid === prediction.outcome_uuid,
    );

    const formattedChoice = this.formatPredictionChoice(
      prediction.choice,
      outcome?.point,
      prop.market_key,
    );

    const date = new DateManager().toMMDDYYYY(prediction.created_at);

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

    const propDescription = prediction.description || outcome?.description;
    let propDetailsValue = `**Choice:** ${formattedChoice}`;
    if (propDescription && propDescription.trim() !== "") {
      propDetailsValue = `**Prop:** ${propDescription}\n${propDetailsValue}`;
    }

    const eventDetailsValue = `**Match:** ${parsedMatchString}\n**Date:** ${date}`;

    const value = `**Status:** ${outcomeStr(outcomeEmoji)}\n\n**Prop Details**\n${propDetailsValue}\n\n**Event Details**\n${eventDetailsValue}`;

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
}
