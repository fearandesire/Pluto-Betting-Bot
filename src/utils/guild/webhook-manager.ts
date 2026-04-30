import {
	type TextChannel,
	type Webhook,
	type WebhookCreateOptions,
} from 'discord.js'
import { createLogger } from '../logging/WinstonLogger.js'

const log = createLogger({ component: 'guild', handler: 'webhook-manager' })

const WEBHOOK_NAME = 'Pluto'

/**
 * Manages Discord webhooks for a channel, creating one when none owned by the
 * bot exists yet and caching subsequent look-ups.
 */
export class WebhookManager {
	private readonly cache = new Map<string, Webhook>()

	/**
	 * Return the bot-owned webhook for `channel`, creating it if necessary.
	 * The result is cached by channel ID so repeated calls within a session
	 * avoid redundant API round-trips.
	 */
	async getOrCreate(
		channel: TextChannel,
		options: Partial<WebhookCreateOptions> = {},
	): Promise<Webhook> {
		const cached = this.cache.get(channel.id)
		if (cached) return cached

		try {
			const webhooks = await channel.fetchWebhooks()
			const clientId = channel.client.user?.id
			const existing = clientId
				? webhooks.find((wh) => wh.owner?.id === clientId)
				: null

			if (existing) {
				this.cache.set(channel.id, existing)
				log.info('Located existing webhook', {
					event: 'webhook.found',
					channelId: channel.id,
					webhookId: existing.id,
				})
				return existing
			}

			const created = await channel.createWebhook({
				name: WEBHOOK_NAME,
				...options,
			})
			this.cache.set(channel.id, created)
			log.info('Created new webhook', {
				event: 'webhook.created',
				channelId: channel.id,
				webhookId: created.id,
			})
			return created
		} catch (error) {
			log.error('Error getting or creating webhook', {
				event: 'webhook.error',
				channelId: channel.id,
				error,
			})
			throw error
		}
	}

	/**
	 * Evict a channel's cached webhook entry, e.g. after a webhook is deleted.
	 */
	invalidate(channelId: string): void {
		this.cache.delete(channelId)
	}

	/**
	 * Fetch all webhooks for `channel` owned by the bot, without touching the
	 * cache.
	 */
	async listOwned(channel: TextChannel): Promise<Webhook[]> {
		try {
			const webhooks = await channel.fetchWebhooks()
			const clientId = channel.client.user?.id
			return clientId
				? webhooks.filter((wh) => wh.owner?.id === clientId).toJSON()
				: []
		} catch (error) {
			log.error('Error listing webhooks', {
				event: 'webhook.list_error',
				channelId: channel.id,
				error,
			})
			return []
		}
	}
}

export const webhookManager = new WebhookManager()
