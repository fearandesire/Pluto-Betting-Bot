import { Redis } from 'ioredis'
import { logger } from '../logging/WinstonLogger.js'
import type { ChannelPayloadMap } from './data/types.js'
import { RedisChannel } from './data/types.js'

const { R_HOST, R_PORT, R_PASS } = process.env

export class RedisPubSubManager {
	private subscriber: Redis
	private publisher: Redis
	private isInitialized = false

	constructor() {
		// Initialize Redis clients with retry strategy
		const redisOptions = {
			host: R_HOST,
			port: Number(R_PORT),
			password: R_PASS,
			retryStrategy: (times: number) => {
				const delay = Math.min(times * 50, 2000)
				return delay
			},
			reconnectOnError: (err: Error) => {
				logger.error({
					message: `Redis reconnection error: ${err.message}`,
					source: 'RedisPubSubManager:reconnectOnError',
				})
				return true
			},
		}

		this.subscriber = new Redis(redisOptions)
		this.publisher = new Redis(redisOptions)

		this.initializeErrorHandling()
		this.init().catch((err) => {
			logger.error({
				message: `Failed to initialize RedisPubSubManager: ${err.message}`,
				source: 'RedisPubSubManager:constructor',
			})
		})
	}

	private initializeErrorHandling(): void {
		this.subscriber.on('error', (err) => {
			logger.error({
				message: `Redis Subscriber Error: ${err.message}`,
				source: 'RedisPubSubManager:subscriber',
			})
		})

		this.publisher.on('error', (err) => {
			logger.error({
				message: `Redis Publisher Error: ${err.message}`,
				source: 'RedisPubSubManager:publisher',
			})
		})
	}

	private async init(): Promise<void> {
		try {
			// Wait for both connections to be ready
			await Promise.all([
				new Promise((resolve) => this.subscriber.on('ready', resolve)),
				new Promise((resolve) => this.publisher.on('ready', resolve)),
			])

			// Subscribe to all channels
			const channels = Object.values(RedisChannel)
			await Promise.all(
				channels.map((channel) => this.subscriber.psubscribe(channel)),
			)

			// Set up message handling
			this.subscriber.on(
				'pmessage',
				(_pattern: string, channel: string, message: string) => {
					try {
						const _parsedMessage = JSON.parse(message)

						switch (channel as RedisChannel) {
							// ? WIP
							case RedisChannel.CHANNEL_CREATION:
								break
							default:
								logger.warn({
									message: `Received message for unknown channel: ${channel}`,
									source: 'RedisPubSubManager:pmessage',
								})
						}
					} catch (error) {
						logger.error({
							message: `Error handling message on channel ${channel}: ${error}`,
							source: 'RedisPubSubManager:pmessage',
							data: { channel, error },
						})
					}
				},
			)

			this.isInitialized = true
			logger.info({
				message: `Successfully subscribed to channels: ${channels.join(', ')}`,
				source: 'RedisPubSubManager:initialize',
			})
		} catch (error) {
			logger.error({
				message: `Failed to initialize Redis PubSub: ${error}`,
				source: 'RedisPubSubManager:init',
			})
			throw error
		}
	}

	public async publish<T extends RedisChannel>(
		channel: T,
		payload: ChannelPayloadMap[T],
	): Promise<void> {
		if (!this.isInitialized) {
			throw new Error('RedisPubSubManager is not initialized')
		}

		try {
			const stringifiedPayload = JSON.stringify(payload)
			const result = await this.publisher.publish(
				channel,
				stringifiedPayload,
			)

			logger.debug({
				message: `Published message to channel: ${channel} (received by ${result} subscribers)`,
				source: 'RedisPubSubManager:publish',
				data: { channel, subscribers: result },
			})
		} catch (error) {
			logger.error({
				message: `Failed to publish to channel ${channel}: ${error}`,
				source: 'RedisPubSubManager:publish',
				data: { channel, error },
			})
			throw error
		}
	}
}

// Export singleton instance
export const redisPubSub = new RedisPubSubManager()
