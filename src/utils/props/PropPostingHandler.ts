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
	/** One ledger reference for each successfully posted outcome */
	results: PostedPropReference[]
	/** Per-pair failures kept explicit for route observability and retries */
	failures: PostingFailure[]
}

export interface PostedPropReference {
	outcome_uuid: string
	guild_id: string
	channel_id: string
	message_id: string
}

export interface PostingFailure {
	guild_id: string
	channel_id?: string
	outcome_uuids: string[]
	error: string
}

interface DeliveredMarker {
	status: 'sent'
	results: PostedPropReference[]
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
	private static readonly DELIVERY_RELEASE_RETRY_TTL_SECONDS = 5
	// Keep the claim for the full idempotency window. Discord does not provide
	// a transaction that atomically commits a message and its Redis marker, so
	// a crash after Discord accepts a send must remain conservatively claimed.
	private static readonly DELIVERY_CLAIM_TTL_SECONDS =
		PropPostingHandler.DELIVERY_TTL_SECONDS
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
			results: [],
			failures: [],
		}

		// 1 Embed:1 Pair
		for (const prop of props) {
			const deliveryKey = this.getDeliveryKey(guildId, channelId, prop)
			const deliveryState = await this.claimDelivery(deliveryKey)
			if (deliveryState.status === 'sent') {
				if (deliveryState.results.length > 0) {
					result.results.push(...deliveryState.results)
					result.posted++
				} else {
					// Legacy markers predate the durable reference ledger. Keep
					// their at-most-once behavior while new markers are recoverable.
					result.filtered++
				}
				continue
			}
			if (deliveryState.status === 'claimed') {
				result.failed++
				result.failures.push({
					guild_id: guildId,
					channel_id: channelId,
					outcome_uuids: [
						prop.over.outcome_uuid,
						prop.under.outcome_uuid,
					],
					error: 'Delivery is already being processed; retry later',
				})
				continue
			}
			if (deliveryState.status === 'unavailable') {
				result.failed++
				result.failures.push({
					guild_id: guildId,
					channel_id: channelId,
					outcome_uuids: [
						prop.over.outcome_uuid,
						prop.under.outcome_uuid,
					],
					error: 'Delivery idempotency unavailable',
				})
				continue
			}

			try {
				const embed = await this.createPropEmbed(prop, sport)
				const buttons = this.createPropButtons(prop)

				const messageOptions = {
					embeds: [embed],
					components: [buttons],
				}
				const message = channelId
					? await this.guildWrapper.sendToChannel(
							channelId,
							messageOptions,
							guildId,
						)
					: await this.guildWrapper.sendToPredictionChannel(
							guildId,
							messageOptions,
						)

				const postedChannelId = channelId ?? message.channelId
				const references = [
					prop.over.outcome_uuid,
					prop.under.outcome_uuid,
				].map((outcome_uuid) => ({
					outcome_uuid,
					guild_id: guildId,
					channel_id: postedChannelId,
					message_id: message.id,
				}))
				await this.markDelivered(deliveryKey, references)
				result.results.push(...references)

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
				result.failures.push({
					guild_id: guildId,
					channel_id: channelId,
					outcome_uuids: [
						prop.over.outcome_uuid,
						prop.under.outcome_uuid,
					],
					error:
						error instanceof Error ? error.message : String(error),
				})
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
		return [
			'props:delivery',
			guildId,
			channelId ?? 'configured',
			prop.over.outcome_uuid,
			prop.under.outcome_uuid,
		].join(':')
	}

	private async claimDelivery(
		deliveryKey: string,
	): Promise<
		| { status: 'available' }
		| { status: 'sent'; results: PostedPropReference[] }
		| { status: 'claimed' }
		| { status: 'unavailable' }
	> {
		try {
			const existing = await redisCache.get(deliveryKey)
			if (existing === 'sent') return { status: 'sent', results: [] }
			if (existing === 'processing') return { status: 'claimed' }
			if (existing === 'retry') {
				try {
					await redisCache.del(deliveryKey)
				} catch {
					return { status: 'claimed' }
				}
			}
			if (existing) {
				try {
					const marker = JSON.parse(existing) as DeliveredMarker
					if (
						marker.status === 'sent' &&
						Array.isArray(marker.results)
					) {
						return { status: 'sent', results: marker.results }
					}
				} catch {
					// An unknown marker is treated as available for compatibility
					// with older deployments that stored a plain status value.
				}
			}

			const lock = await redisCache.set(
				deliveryKey,
				'processing',
				'EX',
				PropPostingHandler.DELIVERY_CLAIM_TTL_SECONDS,
				'NX',
			)
			return lock === 'OK'
				? { status: 'available' }
				: { status: 'claimed' }
		} catch (error) {
			logger.warn({
				method: 'PropPostingHandler',
				event: 'props_delivery_idempotency_unavailable',
				deliveryKey,
				error: error instanceof Error ? error.message : String(error),
			})
			return { status: 'unavailable' }
		}
	}

	private async markDelivered(
		deliveryKey: string,
		results: PostedPropReference[],
	): Promise<void> {
		try {
			await redisCache.setex(
				deliveryKey,
				PropPostingHandler.DELIVERY_TTL_SECONDS,
				JSON.stringify({
					status: 'sent',
					results,
				} satisfies DeliveredMarker),
			)
		} catch (error) {
			logger.error({
				method: 'PropPostingHandler',
				event: 'props_delivery_marker_write_failed',
				deliveryKey,
				error: error instanceof Error ? error.message : String(error),
			})
			try {
				// Some Redis-compatible test/degraded clients do not implement
				// SETEX. A plain SET still records the durable sent ledger and is
				// preferable to leaving a processing claim that can later replay.
				await redisCache.set(
					deliveryKey,
					JSON.stringify({
						status: 'sent',
						results,
					} satisfies DeliveredMarker),
				)
			} catch (fallbackError) {
				logger.error({
					method: 'PropPostingHandler',
					event: 'props_delivery_marker_fallback_failed',
					deliveryKey,
					error:
						fallbackError instanceof Error
							? fallbackError.message
							: String(fallbackError),
				})
			}
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
			try {
				// If DEL failed, shorten the failed-send claim so a retry can
				// recover promptly instead of remaining blocked for seven days.
				await redisCache.setex(
					deliveryKey,
					PropPostingHandler.DELIVERY_RELEASE_RETRY_TTL_SECONDS,
					'processing',
				)
			} catch (fallbackError) {
				logger.error({
					method: 'PropPostingHandler',
					event: 'props_delivery_claim_fallback_failed',
					deliveryKey,
					error:
						fallbackError instanceof Error
							? fallbackError.message
							: String(fallbackError),
				})
				try {
					// Last-resort retry marker for clients where DEL and SETEX are
					// unavailable. A recovered client removes it before re-claiming.
					await redisCache.set(deliveryKey, 'retry')
				} catch (lastError) {
					logger.error({
						method: 'PropPostingHandler',
						event: 'props_delivery_claim_last_resort_failed',
						deliveryKey,
						error:
							lastError instanceof Error
								? lastError.message
								: String(lastError),
					})
				}
			}
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
