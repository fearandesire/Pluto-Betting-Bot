import { PaginatedMessageEmbedFields } from "@sapphire/discord.js-utilities";
import { Subcommand } from "@sapphire/plugin-subcommands";
import { EmbedBuilder, PermissionFlagsBits } from "discord.js";
import embedColors from "../../lib/colorsConfig.js";
import { ApiModules } from "../../lib/interfaces/api/api.interface.js";
import { ApiErrorHandler } from "../../utils/api/Khronos/error-handling/ApiErrorHandler.js";
import PropsApiWrapper from "../../utils/api/Khronos/props/propsApiWrapper.js";
import GuildWrapper from "../../utils/api/Khronos/guild/guild-wrapper.js";
import { MarketKeyTranslations } from "../../utils/api/common/interfaces/market-translations.js";
import { DateManager } from "../../utils/common/DateManager.js";
import TeamInfo from "../../utils/common/TeamInfo.js";
import StringUtils from "../../utils/common/string-utils.js";
import { LogType } from "../../utils/logging/AppLog.interface.js";
import AppLog from "../../utils/logging/AppLog.js";
import { PropResultStatus } from "./types/prop-result.types.js";
import type {
  Prop,
  SetPropResultResponseDto,
} from "./types/prop-result.types.js";

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
    const guildWrapper = new GuildWrapper();

    try {
      await interaction.deferReply();

      // Get guild information to include context in the result
      const guild = await guildWrapper.getGuild(interaction.guildId);

      const response = await propsApi.setResult({
        propId,
        winner: result,
        status: PropResultStatus.COMPLETED,
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

  private async generateProps(
    interaction: Subcommand.ChatInputCommandInteraction,
  ) {
    await interaction.deferReply();

    const count = interaction.options.getInteger("count") || 10;
    const propsApi = new PropsApiWrapper();

    try {
      await interaction.editReply({
        content: `Generating ${count} prop${count > 1 ? "s" : ""}, please wait...`,
      });

      const props = await propsApi.getRandomProps("nba", count);

      const embed = new EmbedBuilder()
        .setTitle("Props Generated")
        .setDescription(
          `Successfully generated ${props.length} random prop${props.length > 1 ? "s" : ""}`,
        )
        .setColor(embedColors.PlutoGreen)
        .addFields(
          props.slice(0, 25).map((prop) => ({
            name: `${prop.name}`,
            value: `**Market:** ${prop.market_key}\n**Price:** ${prop.price}\n**ID:** \`${prop.outcome_uuid}\``,
            inline: true,
          })),
        )
        .setTimestamp();

      await interaction.editReply({
        content: "",
        embeds: [embed],
      });

      await AppLog.log({
        guildId: interaction.guildId,
        description: `${interaction.user.username} generated ${props.length} prop embeds`,
        type: LogType.Info,
      });
    } catch (error) {
      this.container.logger.error(error);
      return new ApiErrorHandler().handle(interaction, error, ApiModules.props);
    }
  }

  private async viewActiveProps(
    interaction: Subcommand.ChatInputCommandInteraction,
  ) {
    try {
      // TODO: Implement endpoint to fetch props with active predictions
      // For now, inform the user that this feature needs backend support
      await interaction.editReply({
        content:
          "This feature requires an endpoint to fetch props with active predictions. " +
          "Please use the prediction history commands to view your active predictions.",
      });

      await AppLog.log({
        guildId: interaction.guildId,
        description: `${interaction.user.username} attempted to view active props (not yet implemented)`,
        type: LogType.Info,
      });
    } catch (error) {
      this.container.logger.error(error);
      return new ApiErrorHandler().handle(interaction, error, ApiModules.props);
    }
  }

  private async sendPropsEmbed(
    interaction: Subcommand.ChatInputCommandInteraction,
    props: Prop[],
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
    prop: Prop,
  ): Promise<{ name: string; value: string; inline: boolean }> {
    const { event_context, market_key, description, point, outcome_uuid } =
      prop;

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
