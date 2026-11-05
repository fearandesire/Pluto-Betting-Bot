import { container } from '@sapphire/framework'
import { ChannelType, type TextChannel } from 'discord.js'
import { logger } from '../logging/WinstonLogger.js'

export const DELIVERY_CLAIM_TTL_SECONDS = 5 * 60

export interface DeliveryChannelResolver {
	getBettingChannel(guildId: string): Promise<TextChannel>
}

export interface DeliveryCache {
	get(key: string): Promise<unknown>
	set(key: string, value: unknown, ttl?: number): Promise<unknown>
	setIfAbsent?(key: string, value: unknown, ttl?: number): Promise<boolean>
	del?(key: string): Promise<unknown>
}

const errorMessage = (error: unknown): string =>
	error instanceof Error ? error.message : String(error)

/**
 * Shared claim/send/persist plumbing for cron digests. `event` prefixes the
 * log messages (for example `weekly_recap`) so dashboards keep their names.
 */

/** Resolve the digest channel: the override when it belongs to the guild, else the betting channel. */
export async function resolveDeliveryChannel(
	channelResolver: DeliveryChannelResolver,
	guildId: string,
	channelId: string | undefined,
	event: string,
): Promise<TextChannel> {
	if (!channelId) return await channelResolver.getBettingChannel(guildId)

	const channel = await container.client.channels.fetch(channelId)
	if (!channel || channel.type !== ChannelType.GuildText) {
		throw new Error(
			`Recap channel ${channelId} is missing or not a text channel`,
		)
	}
	if (channel.guild.id !== guildId) {
		await logger.warn({
			message: `${event}_channel_override_mismatch`,
			metadata: {
				guild_id: guildId,
				channel_id: channelId,
				channel_guild_id: channel.guild.id,
			},
		})
		return await channelResolver.getBettingChannel(guildId)
	}
	return channel
}

/** Take the short-lived processing claim; false means another run owns or finished this key. */
export async function claimDelivery(
	cache: DeliveryCache,
	key: string,
	allowProcessingReclaim: boolean,
): Promise<boolean> {
	if (allowProcessingReclaim) {
		const existing = await cache.get(key)
		const isProcessing =
			typeof existing === 'object' &&
			existing !== null &&
			(existing as { status?: unknown }).status === 'processing'
		if (isProcessing) {
			if (!cache.del) return false
			await cache.del(key)
		}
	}

	if (cache.setIfAbsent) {
		return await cache.setIfAbsent(
			key,
			{ status: 'processing' },
			DELIVERY_CLAIM_TTL_SECONDS,
		)
	}
	if (await cache.get(key)) return false
	await cache.set(key, { status: 'processing' }, DELIVERY_CLAIM_TTL_SECONDS)
	return true
}

export async function releaseDeliveryClaim(
	cache: DeliveryCache,
	key: string,
	event: string,
): Promise<void> {
	try {
		if (cache.del) await cache.del(key)
	} catch (error) {
		await logger.warn({
			message: `${event}_claim_release_failed`,
			metadata: { key, error: errorMessage(error) },
		})
	}
}

/** Record a successful send for `ttlSeconds`; never throws, so a sent post is not reported as failed. */
export async function persistDeliveryMarker(
	cache: DeliveryCache,
	key: string,
	ttlSeconds: number,
	event: string,
	guildId: string,
): Promise<void> {
	try {
		await cache.set(key, true, ttlSeconds)
	} catch (error) {
		await logger.warn({
			message: `${event}_dedup_persist_failed`,
			metadata: {
				guild_id: guildId,
				key,
				error: errorMessage(error),
			},
		})
		try {
			// Keep a durable sent marker lease when the first marker write
			// fails. This closes the post-send crash/retry window without
			// ever treating a failed Discord send as delivered.
			await cache.set(key, { status: 'sent' }, ttlSeconds)
		} catch (fallbackError) {
			await logger.error({
				message: `${event}_dedup_fallback_failed`,
				metadata: {
					guild_id: guildId,
					key,
					error: errorMessage(fallbackError),
				},
			})
		}
	}
}

export function getErrorStatus(error: unknown): number | undefined {
	if (!error || typeof error !== 'object') return undefined
	const response = (error as { response?: { status?: unknown } }).response
	return typeof response?.status === 'number' ? response.status : undefined
}

export { errorMessage }
