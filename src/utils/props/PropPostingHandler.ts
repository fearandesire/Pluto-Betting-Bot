import type { PropDto } from "@kh-openapi";
import { format } from "date-fns";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";
import { MarketKeyTranslations } from "../api/common/interfaces/market-translations.js";
import GuildWrapper from "../api/Khronos/guild/guild-wrapper.js";
import StringUtils from "../common/string-utils.js";
import TeamInfo from "../common/TeamInfo.js";

/**
 * Result object returned after posting props to channel
 */
export interface PostingResult {
  /** Number of props successfully posted */
  posted: number;
  /** Number of props filtered out (e.g., h2h markets) */
  filtered: number;
  /** Number of props that failed to post */
  failed: number;
  /** Total props processed */
  total: number;
}

/**
 * Optional configuration for posting props
 */
export interface PostingOptions {
  /** Whether to filter out h2h markets (default: true) */
  filterH2H?: boolean;
}

/**
 * Handler for posting prop embeds with interactive buttons to Discord channels
 *
 * Responsible for:
 * - Filtering props (removes h2h markets by default)
 * - Creating formatted embeds with prop details
 * - Generating Over/Under button interactions
 * - Posting to guild's configured prediction channel
 *
 * @example
 * ```typescript
 * const handler = new PropPostingHandler();
 * const result = await handler.postPropsToChannel(guildId, props);
 * console.log(`Posted ${result.posted} props, filtered ${result.filtered}`);
 * ```
 */
export class PropPostingHandler {
  private guildWrapper: GuildWrapper;

  constructor() {
    this.guildWrapper = new GuildWrapper();
  }

  /**
   * Posts props to the guild's configured prediction channel
   *
   * Each prop is posted as a separate message with:
   * - Embed containing prop details (player, market, line, matchup, time)
   * - Two buttons: Over and Under
   *
   * H2H markets are filtered out by default as they don't have Over/Under options.
   *
   * @param guildId - Discord guild ID
   * @param props - Array of props from Khronos API
   * @param sport - Sport type ('nfl' or 'nba') for appropriate emoji
   * @param options - Optional configuration (e.g., filtering preferences)
   * @returns Result object with posting statistics
   * @throws Error if prediction channel not configured or posting fails
   */
  async postPropsToChannel(
    guildId: string,
    props: PropDto[],
    sport: "nfl" | "nba",
    options?: PostingOptions,
  ): Promise<PostingResult> {
    const filterH2H = options?.filterH2H ?? true;

    // Filter out h2h markets if enabled (keep spreads, totals, and player props)
    const validProps = filterH2H
      ? props.filter((p) => p.market_key !== "h2h")
      : props;

    const result: PostingResult = {
      posted: 0,
      filtered: props.length - validProps.length,
      failed: 0,
      total: props.length,
    };

    // 1 Embed:1 Prop
    for (const prop of validProps) {
      try {
        const embed = await this.createPropEmbed(prop, sport);
        const buttons = this.createPropButtons(prop);

        await this.guildWrapper.sendToPredictionChannel(guildId, {
          embeds: [embed],
          components: [buttons],
        });

        result.posted++;
      } catch (error) {
        console.error("Failed to post prop", {
          propId: prop.outcome_uuid,
          error,
        });
        result.failed++;
      }
    }

    return result;
  }

  /**
   * Creates a formatted embed for a prop
   *
   * Embed structure:
   * - Title: Clear statement of what's being predicted
   * - Description: Line value, matchup, and game time with prominent Over/Under display
   * - Color: Team color
   * - Timestamp: Current time
   *
   * For totals/team_totals: Uses team name from `name` field
   * For player props: Uses player name from `description` field
   *
   * @param prop - Prop data from API
   * @param sport - Sport type ('nfl' or 'nba') for appropriate emoji
   * @returns Discord embed builder
   * @private
   */
  private async createPropEmbed(
    prop: PropDto,
    sport: "nfl" | "nba",
  ): Promise<EmbedBuilder> {
    const { description, name, market_key, point, event_context, price } = prop;

    // Get translated market name (e.g., "rush yards" -> "Rush Yards")
    const marketTranslation =
      MarketKeyTranslations[market_key] || market_key.replace(/_/g, " ");
    const marketName = StringUtils.toTitleCase(marketTranslation);

    // Format the commence time (e.g., "Sun, 8:06 PM")
    const gameTime = format(
      new Date(event_context.commence_time),
      "EEE, h:mm a",
    );

    // Get team info for both teams
    const teamInfo = async (teamName: string) => {
      const teamInfo = await new TeamInfo().getTeamInfo(teamName);
      return teamInfo;
    };

    const [homeTeamInfo, awayTeamInfo] = await Promise.all([
      teamInfo(event_context.home_team),
      teamInfo(event_context.away_team),
    ]);

    // Determine market type and build title accordingly
    const isTotalsMarket =
      market_key === "totals" || market_key === "team_totals";
    const isSpreadsMarket = market_key === "spreads";

    // For totals/team_totals, use `name` field; for player props, use `description`; for spreads, use `name`
    const subject = isTotalsMarket || isSpreadsMarket ? name : description;

    // Build a clear, explicit title
    let title: string;
    if (isSpreadsMarket) {
      // e.g., "Eagles vs Giants - Spreads"
      title = `${homeTeamInfo.resolvedTeamData.abbrev} vs ${awayTeamInfo.resolvedTeamData.abbrev} - ${marketName}`;
    } else if (isTotalsMarket && market_key === "team_totals") {
      // e.g., "JAX Total Points"
      title = `${subject} ${marketName}`;
    } else if (isTotalsMarket) {
      // e.g., "Game Total Points"
      title = `${homeTeamInfo.resolvedTeamData.abbrev} vs ${awayTeamInfo.resolvedTeamData.abbrev} - ${marketName}`;
    } else {
      // Player props: e.g., "Patrick Mahomes - Passing Touchdowns"
      title = `${subject} - ${marketName}`;
    }

    // Build description with prominent line and explicit prop statement
    const descriptionLines: string[] = [];

    // For spreads, show the spread line prominently
    if (isSpreadsMarket) {
      descriptionLines.push(`## 📊 Point Spread`);
    } else if (point !== null && point !== undefined) {
      // For totals and player props, show Over/Under line
      descriptionLines.push(`## 🎯 Over/Under: ${point}`);
    }

    // Explicitly state what they're betting on
    let propStatement: string;
    if (isSpreadsMarket) {
      propStatement = `## **Prop:** Point Spread - ${homeTeamInfo.resolvedTeamData.abbrev} vs. ${awayTeamInfo.resolvedTeamData.abbrev}`;
    } else if (isTotalsMarket && market_key === "team_totals") {
      propStatement = `## **Prop:** ${subject} ${marketName}`;
    } else if (isTotalsMarket) {
      propStatement = `## **Prop:** Total Points - ${homeTeamInfo.resolvedTeamData.abbrev} vs. ${awayTeamInfo.resolvedTeamData.abbrev}`;
    } else {
      propStatement = `## **Prop:** ${subject} | ${marketName}`;
    }
    descriptionLines.push(propStatement);

    // Add odds for all outcomes
    if (prop.outcomes && prop.outcomes.length > 0) {
      descriptionLines.push(""); // Empty line for visual separation
      descriptionLines.push("**📊 Options:**");

      for (const outcome of prop.outcomes) {
        const oddsDisplay =
          outcome.price > 0 ? `+${outcome.price}` : outcome.price;

        // For spreads, show team name with spread value
        if (
          isSpreadsMarket &&
          outcome.point !== null &&
          outcome.point !== undefined
        ) {
          const spreadDisplay =
            outcome.point > 0 ? `+${outcome.point}` : outcome.point;
          descriptionLines.push(
            `• **${outcome.name} ${spreadDisplay}**: ${oddsDisplay}`,
          );
        } else {
          descriptionLines.push(`• **${outcome.name}**: ${oddsDisplay}`);
        }
      }
    }

    // Add separation line between prop details and match info
    descriptionLines.push(""); // Empty line for visual separation

    // Match information section
    const sportEmoji = sport === "nfl" ? "🏈" : "🏀";
    descriptionLines.push(
      `${sportEmoji} **Match:** ${homeTeamInfo.resolvedTeamData.abbrev} vs. ${awayTeamInfo.resolvedTeamData.abbrev}`,
    );
    descriptionLines.push(`⏰ **Game Time:** ${gameTime}`);

    const embed = new EmbedBuilder()
      .setTitle(title)
      .setDescription(descriptionLines.join("\n"))
      .setColor(homeTeamInfo.color)
      .setTimestamp();

    return embed;
  }

  /**
   * Creates buttons for all possible outcomes (Over/Under, Yes/No, team selections for spreads, etc.)
   *
   * Button format:
   * - Custom ID: `prop_{outcomeName}_{outcome_uuid}`
   * - Labels: Outcome names (e.g., "Over", "Under", "Eagles -7", "Giants +7")
   * - Style: Primary (blue)
   * - Emojis: Dynamic based on outcome type
   *
   * These custom IDs are parsed by ButtonListener to handle predictions.
   * Falls back to legacy Over/Under format if outcomes array is empty.
   *
   * @param prop - Prop data from API
   * @returns ActionRow containing buttons for all outcomes
   * @private
   */
  private createPropButtons(prop: PropDto): ActionRowBuilder<ButtonBuilder> {
    const buttons: ButtonBuilder[] = [];
    const isSpreadsMarket = prop.market_key === "spreads";

    // Use outcomes array if available
    if (prop.outcomes && prop.outcomes.length > 0) {
      for (const outcome of prop.outcomes) {
        // Determine emoji and label based on outcome type
        let emoji = "🎯";
        let label = outcome.name;

        const outcomeLower = outcome.name.toLowerCase();

        if (isSpreadsMarket) {
          // For spreads, show team name with spread value
          if (outcome.point !== null && outcome.point !== undefined) {
            const spreadDisplay =
              outcome.point > 0 ? `+${outcome.point}` : outcome.point;
            label = `${outcome.name} ${spreadDisplay}`;
          }
          // Use shield emoji for spreads
          emoji = "🛡️";
        } else {
          // Standard emoji logic for other markets
          if (outcomeLower === "over") emoji = "⬆️";
          else if (outcomeLower === "under") emoji = "⬇️";
          else if (outcomeLower === "yes") emoji = "✅";
          else if (outcomeLower === "no") emoji = "❌";
        }

        // Create custom ID - sanitize outcome name for spreads (replace spaces with underscores)
        const sanitizedName = outcomeLower.replace(/\s+/g, "_");
        const button = new ButtonBuilder()
          .setCustomId(`prop_${sanitizedName}_${outcome.outcome_uuid}`)
          .setLabel(label)
          .setEmoji(emoji)
          .setStyle(ButtonStyle.Primary);

        buttons.push(button);
      }
    } else {
      // Fallback to legacy Over/Under format for backwards compatibility
      const overButton = new ButtonBuilder()
        .setCustomId(`prop_over_${prop.outcome_uuid}`)
        .setLabel("Over")
        .setEmoji("⬆️")
        .setStyle(ButtonStyle.Primary);

      const underButton = new ButtonBuilder()
        .setCustomId(`prop_under_${prop.outcome_uuid}`)
        .setLabel("Under")
        .setEmoji("⬇️")
        .setStyle(ButtonStyle.Primary);

      buttons.push(overButton, underButton);
    }

    return new ActionRowBuilder<ButtonBuilder>().addComponents(...buttons);
  }
}
