import type { ProcessedPropDto } from '@pluto-khronos/api-client'
import { format } from 'date-fns'
import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	EmbedBuilder,
} from 'discord.js'
import { MarketKeyTranslations } from '../api/common/interfaces/market-translations.js'
import GuildWrapper from '../api/Khronos/guild/guild-wrapper.js'
import redisCache from '../cache/redis-instance.js'
import StringUtils from '../common/string-utils.js'
import TeamInfo from '../common/TeamInfo.js'
import { logger } from '../logging/WinstonLogger.js'

/**
 * Result object returned after posting props to channel
 */
export interface PostingResult {
	/** Number of props successfully posted */
	posted: number
	/** Number of props filtered out (e.g., h2h markets) */
	filtered: number
	/** Number of props that failed to post */
	failed: number
	/** Total props processed */
	total: number
}

/**
 * Handler for posting player prop embeds with interactive Over/Under buttons to Discord channels
 *
 * Responsible for:
 * - Creating formatted embeds with player prop details
 * - Generating Over/Under button interactions
 * - Posting to guild's configured prediction channel
 *
 * Note: Props are pre-paired and filtered by Khronos. Each ProcessedPropDto contains both over and under.
 *
 * @example
 * ```ts
 * const handler = new PropPostingHandler();
 * const propsApi = new PropsApiWrapper();
 * const pairs = await propsApi.getProcessedProps('nfl', 10);
 * const result = await handler.postPropsToChannel(guildId, pairs, 'nfl');
 * console.log(`Posted ${result.posted} player props`);
 * ```
 */
export class PropPostingHandler {
	private static readonly DELIVERY_TTL_SECONDS = 7 * 24 * 60 * 60
	private static readonly DELIVERY_CLAIM_TTL_SECONDS = 5 * 60
	private guildWrapper: GuildWrapper

	constructor() {
		this.guildWrapper = new GuildWrapper()
	}

	/**
	 * Posts player prop pairs to the guild's configured prediction channel
	 *
	 * Each prop pair is posted as a separate message with:
	 * - Embed containing prop details (player, market, line, matchup, time)
	 * - Two buttons: Over and Under
	 *
	 * @param guildId - Discord guild ID
	 * @param props - Array of paired props from Khronos (each contains over and under)
	 * @param sport - Sport type ('nfl' or 'nba') for appropriate emoji
	 * @returns Result object with posting statistics
	 * @throws Error if prediction channel not configured or posting fails
	 */
	async postPropsToChannel(
		guildId: string,
		props: ProcessedPropDto[],
		sport: 'nfl' | 'nba',
		channelId?: string,
	): Promise<PostingResult> {
		const result: PostingResult = {
			posted: 0,
			filtered: 0,
			failed: 0,
			total: props.length,
		}

		// 1 Embed:1 Pair
		for (const prop of props) {
			const deliveryKey = this.getDeliveryKey(guildId, channelId, prop)
			const deliveryState = await this.claimDelivery(deliveryKey)
			if (deliveryState === 'sent' || deliveryState === 'claimed') {
				result.filtered++
				continue
			}
			if (deliveryState === 'unavailable') {
				result.failed++
				continue
			}

			try {
				const embed = await this.createPropEmbed(prop, sport)
				const buttons = this.createPropButtons(prop)

				const messageOptions = {
					embeds: [embed],
					components: [buttons],
				}
				if (channelId) {
					await this.guildWrapper.sendToChannel(
						channelId,
						messageOptions,
					)
				} else {
					await this.guildWrapper.sendToPredictionChannel(
						guildId,
						messageOptions,
					)
				}
				await this.markDelivered(deliveryKey)
				result.posted++
			} catch (error) {
				logger.error('Failed to post prop pair', {
					event_id: prop.event_id,
					market_key: prop.market_key,
					description: prop.description,
					over_uuid: prop.over.outcome_uuid,
					under_uuid: prop.under.outcome_uuid,
					error,
				})
				result.failed++
				await this.releaseDeliveryClaim(deliveryKey)
			}
		}

		return result
	}

	private getDeliveryKey(
		guildId: string,
		channelId: string | undefined,
		prop: ProcessedPropDto,
	): string {
		const destination = channelId ?? 'configured'
		return [
			'props:delivery',
			guildId,
			destination,
			prop.over.outcome_uuid,
			prop.under.outcome_uuid,
		].join(':')
	}

	private async claimDelivery(
		deliveryKey: string,
	): Promise<'available' | 'sent' | 'claimed' | 'unavailable'> {
		try {
			const existing = await redisCache.get(deliveryKey)
			if (existing === 'sent') return 'sent'
			if (existing === 'processing') return 'claimed'

			const lock = await redisCache.set(
				deliveryKey,
				'processing',
				'EX',
				PropPostingHandler.DELIVERY_CLAIM_TTL_SECONDS,
				'NX',
			)
			return lock === 'OK' ? 'available' : 'claimed'
		} catch (error) {
			logger.warn({
				method: 'PropPostingHandler',
				event: 'props_delivery_idempotency_unavailable',
				deliveryKey,
				error: error instanceof Error ? error.message : String(error),
			})
			return 'unavailable'
		}
	}

	private async markDelivered(deliveryKey: string): Promise<void> {
		try {
			await redisCache.setex(
				deliveryKey,
				PropPostingHandler.DELIVERY_TTL_SECONDS,
				'sent',
			)
		} catch (error) {
			logger.error({
				method: 'PropPostingHandler',
				event: 'props_delivery_marker_write_failed',
				deliveryKey,
				error: error instanceof Error ? error.message : String(error),
			})
		}
	}

	private async releaseDeliveryClaim(deliveryKey: string): Promise<void> {
		try {
			await redisCache.del(deliveryKey)
		} catch (error) {
			logger.warn({
				method: 'PropPostingHandler',
				event: 'props_delivery_claim_release_failed',
				deliveryKey,
				error: error instanceof Error ? error.message : String(error),
			})
		}
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
	 * @param prop - Paired prop data from Khronos (contains both over and under)
	 * @param sport - Sport type ('nfl' or 'nba') for appropriate emoji
	 * @returns Discord embed builder
	 * @private
	 */
	private async createPropEmbed(
		prop: ProcessedPropDto,
		sport: 'nfl' | 'nba',
	): Promise<EmbedBuilder> {
		const sportEmoji = sport === 'nfl' ? '🏈' : '🏀'
		const marketTranslation =
			MarketKeyTranslations[prop.market_key] || prop.market_key
		const marketName = StringUtils.toTitleCase(marketTranslation)

		const gameTime = format(new Date(prop.commence_time), 'EEE, h:mm a')

		const [homeTeamInfo, awayTeamInfo] = await Promise.all([
			new TeamInfo().getTeamInfo(prop.home_team),
			new TeamInfo().getTeamInfo(prop.away_team),
		])

		const title = '🎯 Accuracy Challenge'

		const descriptionLines = [
			`### **${prop.description}** • O/U **\`${prop.point}\`** ${marketName}\n`,
			`**Market:** ${marketName}`,
			`**Over**: ${prop.over.price > 0 ? '+' : ''}${prop.over.price}\n**Under**: ${prop.under.price > 0 ? '+' : ''}${prop.under.price}`,
		]

		return new EmbedBuilder()
			.setTitle(title)
			.setDescription(descriptionLines.join('\n'))
			.addFields(
				{
					name: 'Match',
					value: `${sportEmoji} ${homeTeamInfo.resolvedTeamData.abbrev} vs. ${awayTeamInfo.resolvedTeamData.abbrev}`,
					inline: true,
				},
				{
					name: 'Game Time',
					value: `⏰ ${gameTime}`,
					inline: true,
				},
			)
			.setColor(homeTeamInfo.color)
			.setTimestamp()
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
	 * @param prop - Paired prop data from Khronos (contains both over and under)
	 * @returns ActionRow containing Over and Under buttons
	 * @private
	 */
	private createPropButtons(
		prop: ProcessedPropDto,
	): ActionRowBuilder<ButtonBuilder> {
		const overButton = new ButtonBuilder()
			.setCustomId(`prop_${prop.over.outcome_uuid}`)
			.setLabel('Over')
			.setEmoji('⬆️')
			.setStyle(ButtonStyle.Success)

		const underButton = new ButtonBuilder()
			.setCustomId(`prop_${prop.under.outcome_uuid}`)
			.setLabel('Under')
			.setEmoji('⬇️')
			.setStyle(ButtonStyle.Danger)

		return new ActionRowBuilder<ButtonBuilder>().addComponents(
			overButton,
			underButton,
		)
	}
}
