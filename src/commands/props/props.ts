import type { SetPropResultResponseDto } from "@kh-openapi";
import { PaginatedMessageEmbedFields } from "@sapphire/discord.js-utilities";
import { Subcommand } from "@sapphire/plugin-subcommands";
import { EmbedBuilder, PermissionFlagsBits } from "discord.js";
import embedColors from "../../lib/colorsConfig.js";
import { ApiModules } from "../../lib/interfaces/api/api.interface.js";
import { ApiErrorHandler } from "../../utils/api/Khronos/error-handling/ApiErrorHandler.js";
import GuildWrapper from "../../utils/api/Khronos/guild/guild-wrapper.js";
import PredictionApiWrapper from "../../utils/api/Khronos/prediction/predictionApiWrapper.js";
import PropsApiWrapper from "../../utils/api/Khronos/props/propsApiWrapper.js";
import { DateManager } from "../../utils/common/DateManager.js";
import StringUtils from "../../utils/common/string-utils.js";
import { LogType } from "../../utils/logging/AppLog.interface.js";
import AppLog from "../../utils/logging/AppLog.js";
import { logger } from "../../utils/logging/WinstonLogger.js";
import { PropPostingHandler } from "../../utils/props/PropPostingHandler.js";

export class UserCommand extends Subcommand {
  public constructor(
    context: Subcommand.LoaderContext,
    options: Subcommand.Options,
  ) {
    super(context, {
      ...options,
      name: "props",
      description: "Manage props",
      subcommands: [
        {
          name: "view",
          type: "group",
          entries: [{ name: "active", chatInputRun: "viewActive" }],
        },
        {
          name: "generate",
          type: "group",
          entries: [
            { name: "all", chatInputRun: "generateAll" },
          ],
        },
        {
          name: "manage",
          type: "group",
          entries: [{ name: "setresult", chatInputRun: "manageSetresult" }],
        },
      ],
    });
  }

  public override registerApplicationCommands(registry: Subcommand.Registry) {
    registry.registerChatInputCommand(
      (builder) =>
        builder
          .setName(this.name)
          .setDescription(this.description)
          .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
          .addSubcommandGroup((group) =>
            group
              .setName("view")
              .setDescription("View props")
              .addSubcommand((subcommand) =>
                subcommand
                  .setName("active")
                  .setDescription("View props with active predictions"),
              ),
          )
          .addSubcommandGroup((group) =>
            group
              .setName("generate")
              .setDescription("Generate prop embeds")
              .addSubcommand((subcommand) =>
                subcommand
                  .setName("all")
                  .setDescription("Generate prop embeds")
                  .addIntegerOption((option) =>
                    option
                      .setName("count")
                      .setDescription(
                        "Number of props to generate (default: 10)",
                      )
                      .setRequired(false)
                      .setMinValue(1)
                      .setMaxValue(50),
                  ),
              ),
          )
          .addSubcommandGroup((group) =>
            group
              .setName("manage")
              .setDescription("Manage props")
              .addSubcommand((subcommand) =>
                subcommand
                  .setName("setresult")
                  .setDescription("Set the result of a prop")
                  .addStringOption((option) =>
                    option
                      .setName("prop_id")
                      .setDescription("The ID of the prop")
                      .setRequired(true)
                      .setAutocomplete(true),
                  )
                  .addStringOption((option) =>
                    option
                      .setName("result")
                      .setDescription("The result of the prop")
                      .setRequired(true)
                      .addChoices(
                        { name: "Over", value: "Over" },
                        { name: "Under", value: "Under" },
                      ),
                  ),
              ),
          ),
      {
        idHints: ["1289689518940622919", "1290465537859784745"],
      },
    );
  }

  public async viewActive(interaction: Subcommand.ChatInputCommandInteraction) {
    await interaction.deferReply();
    return this.viewActiveProps(interaction);
  }

  public async manageSetresult(
    interaction: Subcommand.ChatInputCommandInteraction,
  ) {
    return this.setResult(interaction);
  }

  public async generateAll(
    interaction: Subcommand.ChatInputCommandInteraction,
  ) {
    return this.generateProps(interaction);
  }

  private async setResult(interaction: Subcommand.ChatInputCommandInteraction) {
    const propId = interaction.options.getString("prop_id", true);
    const result = interaction.options.getString("result", true);

    if (!interaction.guildId) {
      return interaction.reply({
        content: "This command can only be used in a server.",
        ephemeral: true,
      });
    }

    const propsApi = new PropsApiWrapper();

    try {
      await interaction.deferReply();

      const response = await propsApi.setResult({
        propId,
        winner: result,
        status: "completed",
        user_id: interaction.user.id,
      });

      const embed = this.createResultEmbed(response);

      await AppLog.log({
        guildId: interaction.guildId,
        description: `Prop result updated for ${propId} in guild ${interaction.guildId}`,
        type: LogType.Info,
      });

      return interaction.editReply({ embeds: [embed] });
    } catch (error) {
      this.container.logger.error(error);
      return new ApiErrorHandler().handle(interaction, error, ApiModules.props);
    }
  }

  private createResultEmbed(response: SetPropResultResponseDto): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setTitle("Prop Result Updated")
      .setColor(embedColors.PlutoGreen)
      .addFields(
        {
          name: "Correct Predictions",
          value: response.correct_predictions_count.toString(),
          inline: true,
        },
        {
          name: "Incorrect Predictions",
          value: response.incorrect_predictions_count.toString(),
          inline: true,
        },
        {
          name: "Total Predictions",
          value: response.total_predictions_count.toString(),
          inline: true,
        },
      );

    return embed;
  }

  /**
   * Generates random player props and posts them to the guild's prediction channel
   *
   * This command:
   * - Fetches paired player props from Khronos (already filtered and paired)
   * - Creates interactive embeds with Over/Under buttons
   * - Posts each prop pair to the configured prediction channel
   * - Reports back with posting statistics
   *
   * @param interaction - Discord command interaction
   */
  private async generateProps(
    interaction: Subcommand.ChatInputCommandInteraction,
  ) {
    await interaction.deferReply();

    const count = interaction.options.getInteger("count") || 10;
    const propsApi = new PropsApiWrapper();
    const guildWrapper = new GuildWrapper();

    try {
      await interaction.editReply({
        content: `Generating ${count} player prop${count > 1 ? "s" : ""}, please wait...`,
      });

      // Get guild information to determine sport
      const guild = await guildWrapper.getGuild(interaction.guildId);

      // Fetch paired props from Khronos (already filtered and paired with over/under)
      const pairedProps = await propsApi.getProcessedProps(
        guild.sport as "nba" | "nfl",
        count,
      );

      logger.info("Paired player props received from Khronos", {
        guildId: interaction.guildId,
        sport: guild.sport,
        requestedCount: count,
        receivedPairs: pairedProps.length,
        overUuids: pairedProps.map((p) => p.over.outcome_uuid),
        underUuids: pairedProps.map((p) => p.under.outcome_uuid),
      });

      // Post props to prediction channel
      const postingHandler = new PropPostingHandler();
      const result = await postingHandler.postPropsToChannel(
        interaction.guildId,
        pairedProps,
        guild.sport as "nba" | "nfl",
      );

      // Get prediction channel for mention in response
      const predictionChannel = await guildWrapper.getPredictionChannel(
        interaction.guildId,
      );

      // Build success message
      const responseLines: string[] = [
        `✅ Successfully posted **${result.posted}** player prop${result.posted !== 1 ? "s" : ""} to ${predictionChannel}`,
      ];

      if (result.failed > 0) {
        responseLines.push(
          `❌ Failed to post **${result.failed}** prop${result.failed !== 1 ? "s" : ""}`,
        );
      }

      const embed = new EmbedBuilder()
        .setTitle("Player Props Posted")
        .setDescription(responseLines.join("\n"))
        .setColor(embedColors.PlutoGreen)
        .addFields(
          {
            name: "Total Pairs",
            value: result.total.toString(),
            inline: true,
          },
          {
            name: "Posted",
            value: result.posted.toString(),
            inline: true,
          },
          {
            name: "Failed",
            value: result.failed.toString(),
            inline: true,
          },
        )
        .setTimestamp();

      await interaction.editReply({
        content: "",
        embeds: [embed],
      });

      await AppLog.log({
        guildId: interaction.guildId,
        description: `${interaction.user.username} posted ${result.posted} player prop embeds to prediction channel`,
        type: LogType.Info,
      });
    } catch (error) {
      this.container.logger.error(error);

      // Check if error is due to missing prediction channel config
      if (
        error instanceof Error &&
        error.message.includes("Prediction channel not configured")
      ) {
        await interaction.editReply({
          content:
            "❌ This guild does not have a prediction channel configured. Please set one up using the guild configuration commands.",
        });
        return;
      }

      return new ApiErrorHandler().handle(interaction, error, ApiModules.props);
    }
  }

  private async viewActiveProps(
    interaction: Subcommand.ChatInputCommandInteraction,
  ) {
    try {
      const predictionApi = new PredictionApiWrapper();

      // Fetch active outcomes grouped by date and game from Khronos
      const dateGroups = await predictionApi.getActiveOutcomesGrouped({
        guildId: interaction.guildId,
      });

      // Check if there are any active outcomes
      if (!dateGroups || dateGroups.length === 0) {
        await interaction.editReply({
          content: "No active predictions found. All props have been settled!",
        });
        return;
      }

      // Count total outcomes across all dates and games
      const totalOutcomes = dateGroups.reduce(
        (dateAcc, dateGroup) =>
          dateAcc +
          dateGroup.games.reduce(
            (gameAcc, game) => gameAcc + game.props.length,
            0,
          ),
        0,
      );

      if (totalOutcomes === 0) {
        await interaction.editReply({
          content: "No active predictions found. All props have been settled!",
        });
        return;
      }

      // Build embed with outcome list
      const embed = new EmbedBuilder()
        .setTitle("Active Props - Pending Results")
        .setDescription(
          `Found **${totalOutcomes}** outcome${totalOutcomes !== 1 ? "s" : ""} with active predictions across **${dateGroups.length}** date${dateGroups.length !== 1 ? "s" : ""}.\nUse \`/props manage setresult\` to settle these props.`,
        )
        .setColor(embedColors.PlutoBlue)
        .setTimestamp();

      // Format each outcome into a field, organized by date and game
      const fields: Array<{ name: string; value: string; inline: boolean }> = [];

      for (const dateGroup of dateGroups) {
        // Add date header
        const dateObj = new Date(dateGroup.date);
        const formattedDate = dateObj.toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          year: "numeric",
        });

        fields.push({
          name: `\u200B\n📅 ${formattedDate}`,
          value: "\u200B",
          inline: false,
        });

        // Add games and props for this date
        for (const game of dateGroup.games) {
          const gameTime = new DateManager().toDiscordUnix(game.commence_time);
          const gameTotalPredictions = game.props.reduce(
            (sum, prop) => sum + prop.prediction_count,
            0,
          );

          // Add game header
          fields.push({
            name: `🏀 ${game.matchup}`,
            value: `Time: ${gameTime} • ${gameTotalPredictions} prediction${gameTotalPredictions !== 1 ? "s" : ""}`,
            inline: false,
          });

          // Add each prop for this game
          for (const prop of game.props) {
            const propParts: string[] = [
              `**Market:** ${StringUtils.toTitleCase(prop.market_key.replace(/_/g, " "))}`,
            ];

            if (prop.description) {
              propParts.push(`**Player:** ${prop.description}`);
            }

            if (prop.point !== null && prop.point !== undefined) {
              propParts.push(`**Line:** ${prop.point}`);
            }

            propParts.push(`**Predictions:** ${prop.prediction_count}`);

            fields.push({
              name: `  └ 🎯 ${prop.outcome_uuid}`,
              value: `  ${propParts.join(" • ")}`,
              inline: false,
            });
          }
        }
      }

      // Split into multiple embeds if too many fields (Discord limit is 25 fields per embed)
      if (fields.length <= 25) {
        embed.addFields(fields);
        await interaction.editReply({ embeds: [embed] });
      } else {
        // Use paginated message for many outcomes
        const paginatedMsg = new PaginatedMessageEmbedFields({
          template: { embeds: [embed] },
        })
          .setItems(fields)
          .setItemsPerPage(10)
          .make();

        return paginatedMsg.run(interaction);
      }

      await AppLog.log({
        guildId: interaction.guildId,
        description: `${interaction.user.username} viewed ${totalOutcomes} active prop outcomes across ${dateGroups.length} date(s)`,
        type: LogType.Info,
      });
    } catch (error) {
      this.container.logger.error(error);
      return new ApiErrorHandler().handle(interaction, error, ApiModules.props);
    }
  }
}
