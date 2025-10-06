import type { PropDto } from '@kh-openapi';
import { format } from 'date-fns';
import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	EmbedBuilder,
} from 'discord.js';
import { MarketKeyTranslations } from '../api/common/interfaces/market-translations.js';
import GuildWrapper from '../api/Khronos/guild/guild-wrapper.js';
import StringUtils from '../common/string-utils.js';
import TeamInfo from '../common/TeamInfo.js';

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
	 * @param options - Optional configuration (e.g., filtering preferences)
	 * @returns Result object with posting statistics
	 * @throws Error if prediction channel not configured or posting fails
	 */
	async postPropsToChannel(
		guildId: string,
		props: PropDto[],
		options?: PostingOptions,
	): Promise<PostingResult> {
		const filterH2H = options?.filterH2H ?? true;

		// Filter out h2h markets if enabled
		const validProps = filterH2H
			? props.filter((p) => p.market_key !== 'h2h')
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
				const embed = await this.createPropEmbed(prop);
				const buttons = this.createPropButtons(prop);

				await this.guildWrapper.sendToPredictionChannel(guildId, {
					embeds: [embed],
					components: [buttons],
				});

				result.posted++;
			} catch (error) {
				console.error('Failed to post prop', {
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
	 * - Title: Player name + Market type (e.g., "Tony Pollard - Rush Yards")
	 * - Description: Line value, matchup, and game time
	 * - Color: Pluto Blue
	 * - Footer: Bookmaker attribution
	 * - Timestamp: Current time
	 * 
	 * @param prop - Prop data from API
	 * @returns Discord embed builder
	 * @private
	 */
	private async createPropEmbed(prop: PropDto): Promise<EmbedBuilder> {
		const {
			description,
			market_key,
			point,
			event_context,
			bookmaker_key,
			price,
		} = prop;

		// Get translated market name (e.g., "rush yards" -> "Rush Yards")
		const marketTranslation =
			MarketKeyTranslations[market_key] || market_key.replace(/_/g, ' ');
		const marketName = StringUtils.toTitleCase(marketTranslation);

		// Format the commence time (e.g., "Sun, 8:06 PM")
		const gameTime = format(new Date(event_context.commence_time), 'EEE, h:mm a');

		// Build description with line, matchup, and time
		const descriptionLines: string[] = [];

		if (point !== null && point !== undefined) {
			descriptionLines.push(`**Over/Under:** ${point}`);
		}


		// shortening the team names for display reasons
		const teamInfo = async (teamName: string) => {
			const teamInfo = await new TeamInfo().getTeamInfo(teamName);
			return teamInfo
		};

		const [homeTeamInfo, awayTeamInfo] = await Promise.all([teamInfo(event_context.home_team), teamInfo(event_context.away_team)]);

		descriptionLines.push(
			`**Match:** ${homeTeamInfo.resolvedTeamData.abbrev} vs ${awayTeamInfo.resolvedTeamData.abbrev}`,
		);
		descriptionLines.push(`**Game Time:** ${gameTime}`);

		// Add odds if available
		if (price) {
			descriptionLines.push(`**Odds:** ${price > 0 ? '+' : ''}${price}`);
		}

		const embed = new EmbedBuilder()
			.setTitle(`${description} ‖ ${marketName}`)
			.setDescription(descriptionLines.join('\n'))
			.setColor(homeTeamInfo.color)
			.setTimestamp();

		return embed;
	}

	/**
	 * Creates Over/Under buttons for a prop
	 * 
	 * Button format:
	 * - Custom ID: `prop_over_{outcome_uuid}` and `prop_under_{outcome_uuid}`
	 * - Labels: "Over" and "Under"
	 * - Style: Primary (blue)
	 * 
	 * These custom IDs are parsed by ButtonListener to handle predictions.
	 * 
	 * @param prop - Prop data from API
	 * @returns ActionRow containing both buttons
	 * @private
	 */
	private createPropButtons(prop: PropDto): ActionRowBuilder<ButtonBuilder> {
		const overButton = new ButtonBuilder()
			.setCustomId(`prop_over_${prop.outcome_uuid}`)
			.setLabel('Over')
			.setEmoji('⬆️')
			.setStyle(ButtonStyle.Primary);

		const underButton = new ButtonBuilder()
			.setCustomId(`prop_under_${prop.outcome_uuid}`)
			.setLabel('Under')
			.setEmoji('⬇️')
			.setStyle(ButtonStyle.Primary);

		return new ActionRowBuilder<ButtonBuilder>().addComponents(
			overButton,
			underButton,
		);
	}
}

