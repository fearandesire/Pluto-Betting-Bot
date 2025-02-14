import { Redis } from 'ioredis';
// import { channelCreationQueue } from './queue/ChannelCreationQueue.js';
import { WinstonLogger } from '../logging/WinstonLogger.js';
import type { ChannelCreationPayload } from './redis/schemas.js';
import { channelCreationEventSchema } from './redis/schemas.js';
import { RedisChannel } from './redis/types.js';
import type { ChannelPayloadMap } from './redis/types.js';
const { R_HOST, R_PORT, R_PASS } = process.env;

export class RedisPubSubManager {
	private subscriber: Redis;
	private publisher: Redis;
	private isInitialized = false;

	constructor() {
		// Initialize Redis clients with retry strategy
		const redisOptions = {
			host: R_HOST,
			port: Number(R_PORT),
			password: R_PASS,
			retryStrategy: (times: number) => {
				const delay = Math.min(times * 50, 2000);
				return delay;
			},
			reconnectOnError: (err: Error) => {
				WinstonLogger.error({
					message: `Redis reconnection error: ${err.message}`,
					source: 'RedisPubSubManager:reconnectOnError',
				});
				return true;
			},
		};

		this.subscriber = new Redis(redisOptions);
		this.publisher = new Redis(redisOptions);

		this.initializeErrorHandling();
		this.init().catch((err) => {
			WinstonLogger.error({
				message: `Failed to initialize RedisPubSubManager: ${err.message}`,
				source: 'RedisPubSubManager:constructor',
			});
		});
	}

	private initializeErrorHandling(): void {
		this.subscriber.on('error', (err) => {
			WinstonLogger.error({
				message: `Redis Subscriber Error: ${err.message}`,
				source: 'RedisPubSubManager:subscriber',
			});
		});

		this.publisher.on('error', (err) => {
			WinstonLogger.error({
				message: `Redis Publisher Error: ${err.message}`,
				source: 'RedisPubSubManager:publisher',
			});
		});
	}

	private async init(): Promise<void> {
		try {
			// Wait for both connections to be ready
			await Promise.all([
				new Promise((resolve) => this.subscriber.on('ready', resolve)),
				new Promise((resolve) => this.publisher.on('ready', resolve)),
			]);

			// Subscribe to all channels
			const channels = Object.values(RedisChannel);
			await Promise.all(
				channels.map((channel) => this.subscriber.psubscribe(channel)),
			);

			// Set up message handling
			this.subscriber.on(
				'pmessage',
				(_pattern: string, channel: string, message: string) => {
					try {
						const parsedMessage = JSON.parse(message);

						switch (channel as RedisChannel) {
							case RedisChannel.CHANNEL_CREATION:
								this.handleChannelCreation(parsedMessage);
								break;
							default:
								WinstonLogger.warn({
									message: `Received message for unknown channel: ${channel}`,
									source: 'RedisPubSubManager:pmessage',
								});
						}
					} catch (error) {
						WinstonLogger.error({
							message: `Error handling message on channel ${channel}: ${error}`,
							source: 'RedisPubSubManager:pmessage',
							data: { channel, error },
						});
					}
				},
			);

			this.isInitialized = true;
			WinstonLogger.info({
				message: `Successfully subscribed to channels: ${channels.join(', ')}`,
				source: 'RedisPubSubManager:initialize',
			});
		} catch (error) {
			WinstonLogger.error({
				message: `Failed to initialize Redis PubSub: ${error}`,
				source: 'RedisPubSubManager:init',
			});
			throw error;
		}
	}

	public async publish<T extends RedisChannel>(
		channel: T,
		payload: ChannelPayloadMap[T],
	): Promise<void> {
		if (!this.isInitialized) {
			throw new Error('RedisPubSubManager is not initialized');
		}

		try {
			const stringifiedPayload = JSON.stringify(payload);
			const result = await this.publisher.publish(channel, stringifiedPayload);

			WinstonLogger.debug({
				message: `Published message to channel: ${channel} (received by ${result} subscribers)`,
				source: 'RedisPubSubManager:publish',
				data: { channel, subscribers: result },
			});
		} catch (error) {
			WinstonLogger.error({
				message: `Failed to publish to channel ${channel}: ${error}`,
				source: 'RedisPubSubManager:publish',
				data: { channel, error },
			});
			throw error;
		}
	}

	// Channel-specific handlers
	private async handleChannelCreation(
		payload: ChannelCreationPayload,
	): Promise<void> {
		try {
			// validate payload
			const validatedPayload = channelCreationEventSchema.parse(payload);

			// Add to queue instead of processing directly
			// await channelCreationQueue.addToQueue(validatedPayload);

			WinstonLogger.info({
				message: `Added channel creation to queue: ${validatedPayload.channel.id}`,
				source: 'RedisPubSubManager:handleChannelCreation',
				data: {
					channelId: validatedPayload.channel.id,
					guildId: validatedPayload.guild.guildId,
				},
			});
		} catch (error) {
			WinstonLogger.error({
				message: `Error handling channel creation: ${error}`,
				source: 'RedisPubSubManager:handleChannelCreation',
			});
		}
	}
}

// Export singleton instance
export const redisPubSub = new RedisPubSubManager();
