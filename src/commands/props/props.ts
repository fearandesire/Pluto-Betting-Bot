import type {
  PropDto,
  PropOutcomeDetailDto,
  SetPropResultResponseDto,
} from "@kh-openapi";
import { PaginatedMessageEmbedFields } from "@sapphire/discord.js-utilities";
import { Subcommand } from "@sapphire/plugin-subcommands";
import { EmbedBuilder, PermissionFlagsBits } from "discord.js";
import embedColors from "../../lib/colorsConfig.js";
import { ApiModules } from "../../lib/interfaces/api/api.interface.js";
import { ApiErrorHandler } from "../../utils/api/Khronos/error-handling/ApiErrorHandler.js";
import GuildWrapper from "../../utils/api/Khronos/guild/guild-wrapper.js";
import PredictionApiWrapper from "../../utils/api/Khronos/prediction/predictionApiWrapper.js";
import PropsApiWrapper from "../../utils/api/Khronos/props/propsApiWrapper.js";
import { MarketKeyTranslations } from "../../utils/api/common/interfaces/market-translations.js";
import { DateManager } from "../../utils/common/DateManager.js";
import TeamInfo from "../../utils/common/TeamInfo.js";
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
            { name: "prop_embed", chatInputRun: "generatePropEmbed" },
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
                      .setRequired(true),
                  )
                  .addStringOption((option) =>
                    option
                      .setName("result")
                      .setDescription("The result of the prop")
                      .setRequired(true),
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
   * Generates random props and posts them to the guild's prediction channel
   *
   * This command:
   * - Fetches random props from Khronos based on guild's sport
   * - Filters out h2h markets (not suitable for Over/Under predictions)
   * - Creates interactive embeds with Over/Under buttons
   * - Posts each prop to the configured prediction channel
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
        content: `Generating ${count} prop${count > 1 ? "s" : ""}, please wait...`,
      });

      // Get guild information to determine sport
      const guild = await guildWrapper.getGuild(interaction.guildId);

      // Fetch random props from Khronos
      const props = await propsApi.getRandomProps(
        guild.sport as "nba" | "nfl",
        count,
      );

      // Log how many random props we received from Khronos
      logger.info("Random props received from Khronos API", {
        guildId: interaction.guildId,
        sport: guild.sport,
        requestedCount: count,
        receivedCount: props.length,
        propIds: props.map((p) => p.outcomes.map((o) => o.outcome_uuid)).flat(),
      });

      // Post props to prediction channel
      const postingHandler = new PropPostingHandler();
      const result = await postingHandler.postPropsToChannel(
        interaction.guildId,
        props,
        guild.sport as "nba" | "nfl",
      );

      // Get prediction channel for mention in response
      const predictionChannel = await guildWrapper.getPredictionChannel(
        interaction.guildId,
      );

      // Build success message
      const responseLines: string[] = [
        `✅ Successfully posted **${result.posted}** prop${result.posted !== 1 ? "s" : ""} to ${predictionChannel}`,
      ];

      if (result.filtered > 0) {
        responseLines.push(
          `🔽 Filtered out **${result.filtered}** h2h market${result.filtered !== 1 ? "s" : ""}`,
        );
      }

      if (result.failed > 0) {
        responseLines.push(
          `❌ Failed to post **${result.failed}** prop${result.failed !== 1 ? "s" : ""}`,
        );
      }

      const embed = new EmbedBuilder()
        .setTitle("Props Posted")
        .setDescription(responseLines.join("\n"))
        .setColor(embedColors.PlutoGreen)
        .addFields(
          {
            name: "Total Generated",
            value: result.total.toString(),
            inline: true,
          },
          {
            name: "Posted",
            value: result.posted.toString(),
            inline: true,
          },
          {
            name: "Filtered",
            value: result.filtered.toString(),
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
        description: `${interaction.user.username} posted ${result.posted} prop embeds to prediction channel`,
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

      // Fetch active outcomes from Khronos
      const data = await predictionApi.getActiveOutcomes({
        guildId: interaction.guildId,
      });

      // Check if there are any active outcomes
      if (
        !data.outcomes ||
        data.outcomes.length === 0 ||
        data.total_outcomes === 0
      ) {
        await interaction.editReply({
          content: "No active predictions found. All props have been settled!",
        });
        return;
      }

      // Build embed with outcome list
      const embed = new EmbedBuilder()
        .setTitle("Active Props - Pending Results")
        .setDescription(
          `Found **${data.total_outcomes}** outcome${data.total_outcomes !== 1 ? "s" : ""} with active predictions.\nUse \`/props manage setresult\` to settle these props.`,
        )
        .setColor(embedColors.PlutoBlue)
        .setTimestamp();

      // Format each outcome into a field
      const fields = data.outcomes.map((outcome: any) => {
        const matchup = `${outcome.home_team} vs ${outcome.away_team}`;
        const date = new DateManager().toDiscordUnix(outcome.commence_time);

        // Build description parts
        const parts = [
          `**Matchup:** ${matchup}`,
          `**Market:** ${StringUtils.toTitleCase(outcome.market_key.replace(/_/g, " "))}`,
        ];

        if (outcome.description) {
          parts.push(`**Player:** ${outcome.description}`);
        }

        if (outcome.point !== null && outcome.point !== undefined) {
          parts.push(`**Line:** ${outcome.point}`);
        }

        parts.push(
          `**Date:** ${date}`,
          `**Predictions:** ${outcome.prediction_count}`,
        );

        return {
          name: `🎯 ${outcome.outcome_uuid}`,
          value: parts.join("\n"),
          inline: false,
        };
      });

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
        description: `${interaction.user.username} viewed ${data.total_outcomes} active prop outcomes`,
        type: LogType.Info,
      });
    } catch (error) {
      this.container.logger.error(error);
      return new ApiErrorHandler().handle(interaction, error, ApiModules.props);
    }
  }

  private async sendPropsEmbed(
    interaction: Subcommand.ChatInputCommandInteraction,
    props: PropDto[],
    title: string,
    description: string,
    options?: PropEmbedOptions,
  ) {
    try {
      if (props.length === 0) {
        return interaction.editReply({
          content: "No props were found matching the search criteria.",
        });
      }

      const templateEmbed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(embedColors.PlutoBlue)
        .setTimestamp();

      if (options?.isViewingActiveProps) {
        const formattedProps = await Promise.all(
          props.map((prop) => this.formatPropField(prop)),
        );

        const paginatedMsg = new PaginatedMessageEmbedFields({
          template: { embeds: [templateEmbed] },
        })
          .setItems(formattedProps)
          .setItemsPerPage(15)
          .make();

        return paginatedMsg.run(interaction);
      }

      const firstProp = props[0];
      const date = new DateManager().toDiscordUnix(
        firstProp.event_context.commence_time,
      );

      templateEmbed.setDescription(
        `${description}\n\n**Event Information**\n🆔 **Event ID:** \`${firstProp.event_id}\`\n🗓️ **Date:** ${date}\n${firstProp.event_context.home_team} vs ${firstProp.event_context.away_team}`,
      );

      const formattedProps = await Promise.all(
        props.map((prop) => this.formatPropField(prop)),
      );

      templateEmbed.addFields(formattedProps);
      return interaction.editReply({ embeds: [templateEmbed] });
    } catch (error) {
      this.container.logger.error(error);
      return new ApiErrorHandler().handle(interaction, error, ApiModules.props);
    }
  }

  private async formatPropField(
    prop: PropDto,
  ): Promise<{ name: string; value: string; inline: boolean }> {
    const { event_context, market_key, outcomes } = prop;

    // Get the first outcome for display (props typically have Over/Under or similar pairs)
    const firstOutcome: PropOutcomeDetailDto | undefined = outcomes?.[0];
    if (!firstOutcome) {
      throw new Error(
        `No outcomes found for prop with event_id: ${prop.event_id}`,
      );
    }

    const description = firstOutcome.description;
    const point = firstOutcome.point;
    const outcome_uuid = firstOutcome.outcome_uuid;

    const homeTeam = await TeamInfo.resolveTeamIdentifier(
      event_context.home_team,
    );
    const awayTeam = await TeamInfo.resolveTeamIdentifier(
      event_context.away_team,
    );
    const matchup = `${homeTeam} vs. ${awayTeam}`;

    const translatedKey = StringUtils.toTitleCase(
      MarketKeyTranslations[market_key],
    );

    let title: string;
    if (description) {
      title = `${description} - ${translatedKey}`;
    } else if (market_key.toLowerCase() === "h2h") {
      title = `${matchup} - H2H`;
    } else if (market_key.toLowerCase().includes("total")) {
      title = `${matchup} - Totals`;
    } else {
      title = `${matchup} - ${translatedKey}`;
    }

    const details = [`**Prop ID:** \`${outcome_uuid}\``];

    if (
      point !== null &&
      point !== undefined &&
      market_key.toLowerCase() !== "h2h" &&
      !market_key.toLowerCase().includes("total")
    ) {
      details.push(`**Over/Under:** ${point}`);
    }

    const date = new DateManager().toDiscordUnix(event_context.commence_time);
    details.push(`**Date:** ${date}`);

    return {
      name: title,
      value: details.join("\n"),
      inline: true,
    };
  }
}

interface PropEmbedOptions {
  isViewingActiveProps?: boolean;
}
