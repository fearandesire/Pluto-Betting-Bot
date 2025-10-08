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
import type { PropPair } from "./PropPairingService.js";

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
 * Handler for posting player prop embeds with interactive Over/Under buttons to Discord channels
 *
 * Responsible for:
 * - Creating formatted embeds with player prop details
 * - Generating Over/Under button interactions
 * - Posting to guild's configured prediction channel
 *
 * Note: Prop filtering is now handled by Khronos. This handler expects pre-filtered player props only.
 *
 * @example
 * ```typescript
 * const handler = new PropPostingHandler();
 * const pairingService = new PropPairingService();
 * const pairs = pairingService.groupIntoPairs(processedProps);
 * const result = await handler.postPropsToChannel(guildId, pairs, 'nfl');
 * console.log(`Posted ${result.posted} player props`);
 * ```
 */
export class PropPostingHandler {
  private guildWrapper: GuildWrapper;

  constructor() {
    this.guildWrapper = new GuildWrapper();
  }

  /**
   * Posts player prop pairs to the guild's configured prediction channel
   *
   * Each prop pair is posted as a separate message with:
   * - Embed containing prop details (player, market, line, matchup, time)
   * - Two buttons: Over and Under
   *
   * @param guildId - Discord guild ID
   * @param pairs - Array of prop pairs (over/under) from PropPairingService
   * @param sport - Sport type ('nfl' or 'nba') for appropriate emoji
   * @returns Result object with posting statistics
   * @throws Error if prediction channel not configured or posting fails
   */
  async postPropsToChannel(
    guildId: string,
    pairs: PropPair[],
    sport: "nfl" | "nba",
  ): Promise<PostingResult> {
    const result: PostingResult = {
      posted: 0,
      filtered: 0,
      failed: 0,
      total: pairs.length,
    };

    // 1 Embed:1 Pair
    for (const pair of pairs) {
      try {
        const embed = await this.createPropEmbed(pair, sport);
        const buttons = this.createPropButtons(pair);

        await this.guildWrapper.sendToPredictionChannel(guildId, {
          embeds: [embed],
          components: [buttons],
        });

        result.posted++;
      } catch (error) {
        console.error("Failed to post prop pair", {
          event_id: pair.event_id,
          market_key: pair.market_key,
          outcome_name: pair.outcome_name,
          over_uuid: pair.over.outcome_uuid,
          under_uuid: pair.under.outcome_uuid,
          error,
        });
        result.failed++;
      }
    }

    return result;
  }

  /**
   * Creates a formatted embed for a player prop pair
   *
   * Embed structure:
   * - Title: Player name and market type
   * - Description: Line value, odds for over/under, matchup, and game time
   * - Color: Team color
   * - Timestamp: Current time
   *
   * @param pair - Prop pair data (over/under)
   * @param sport - Sport type ('nfl' or 'nba') for appropriate emoji
   * @returns Discord embed builder
   * @private
   */
  private async createPropEmbed(
    pair: PropPair,
    sport: "nfl" | "nba",
  ): Promise<EmbedBuilder> {
    const sportEmoji = sport === "nfl" ? "🏈" : "🏀";
    const marketTranslation =
      MarketKeyTranslations[pair.market_key] || pair.market_key;
    const marketName = StringUtils.toTitleCase(marketTranslation);

    const gameTime = format(new Date(pair.commence_time), "EEE, h:mm a");

    const [homeTeamInfo, awayTeamInfo] = await Promise.all([
      new TeamInfo().getTeamInfo(pair.home_team),
      new TeamInfo().getTeamInfo(pair.away_team),
    ]);

    const title = `${pair.outcome_name} - ${marketName}`;

    const descriptionLines = [
      `## 🎯 Over/Under: ${pair.point}`,
      `## **Prop:** ${pair.outcome_name} | ${marketName}`,
      "",
      "**📊 Options:**",
      `• **Over ${pair.point}**: ${pair.over.price > 0 ? "+" : ""}${pair.over.price}`,
      `• **Under ${pair.point}**: ${pair.under.price > 0 ? "+" : ""}${pair.under.price}`,
      "",
      `${sportEmoji} **Match:** ${homeTeamInfo.resolvedTeamData.abbrev} vs. ${awayTeamInfo.resolvedTeamData.abbrev}`,
      `⏰ **Game Time:** ${gameTime}`,
    ];

    return new EmbedBuilder()
      .setTitle(title)
      .setDescription(descriptionLines.join("\n"))
      .setColor(homeTeamInfo.color)
      .setTimestamp();
  }

  /**
   * Creates Over/Under buttons for a player prop pair
   *
   * Button format:
   * - Custom ID: `prop_{outcome_uuid}`
   * - Labels: "Over {point}" and "Under {point}"
   * - Style: Success (green) for Over, Danger (red) for Under
   * - Emojis: ⬆️ for Over, ⬇️ for Under
   *
   * @param pair - Prop pair data (over/under)
   * @returns ActionRow containing Over and Under buttons
   * @private
   */
  private createPropButtons(pair: PropPair): ActionRowBuilder<ButtonBuilder> {
    const overButton = new ButtonBuilder()
      .setCustomId(`prop_${pair.over.outcome_uuid}`)
      .setLabel(`Over ${pair.point}`)
      .setEmoji("⬆️")
      .setStyle(ButtonStyle.Success);

    const underButton = new ButtonBuilder()
      .setCustomId(`prop_${pair.under.outcome_uuid}`)
      .setLabel(`Under ${pair.point}`)
      .setEmoji("⬇️")
      .setStyle(ButtonStyle.Danger);

    return new ActionRowBuilder<ButtonBuilder>().addComponents(
      overButton,
      underButton,
    );
  }
}
