import { Redis } from 'ioredis';
import { WinstonLogger } from '../logging/WinstonLogger.js';
import type { ChannelCreationPayload } from './redis/schemas.js';
import { RedisChannel } from './redis/types.js';
import type {
	BetPlacedPayload,
	BetSettledPayload,
	ChannelPayloadMap,
	GuildUpdatePayload,
	UserUpdatePayload,
} from './redis/types.js';

const { R_HOST, R_PORT, R_PASS, R_DB } = process.env;

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
							case RedisChannel.USER_UPDATE:
								this.handleUserUpdate(parsedMessage);
								break;
							case RedisChannel.GUILD_UPDATE:
								this.handleGuildUpdate(parsedMessage);
								break;
							case RedisChannel.BET_PLACED:
								this.handleBetPlaced(parsedMessage);
								break;
							case RedisChannel.BET_SETTLED:
								this.handleBetSettled(parsedMessage);
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
		// Pseudo code for channel creation handling
		try {
			console.log({ payload });
			// 1. Update cache with new channel info
			// await Cache().set(`channel:${payload.channelId}`, payload);

			// 2. Notify relevant services
			// await notifyChannelCreation(payload);

			// 3. Update analytics
			// await trackChannelCreation(payload);

			WinstonLogger.info({
				message: `Handled channel creation: ${payload.channel.id}`,
				source: 'RedisPubSubManager:handleChannelCreation',
			});
		} catch (error) {
			WinstonLogger.error({
				message: `Error handling channel creation: ${error}`,
				source: 'RedisPubSubManager:handleChannelCreation',
			});
		}
	}

	private async handleUserUpdate(payload: UserUpdatePayload): Promise<void> {
		// Pseudo code for user update handling
		try {
			// 1. Update user cache
			// await Cache().set(`user:${payload.userId}`, payload);

			// 2. Update related guild cache
			// await updateGuildUserCache(payload);

			// 3. Trigger relevant events
			// await emitUserUpdateEvents(payload);

			WinstonLogger.info({
				message: `Handled user update: ${payload.userId}`,
				source: 'RedisPubSubManager:handleUserUpdate',
			});
		} catch (error) {
			WinstonLogger.error({
				message: `Error handling user update: ${error}`,
				source: 'RedisPubSubManager:handleUserUpdate',
			});
		}
	}

	private async handleGuildUpdate(payload: GuildUpdatePayload): Promise<void> {
		// Pseudo code for guild update handling
		try {
			// 1. Update guild cache
			// await Cache().set(`guild:${payload.guildId}`, payload);

			// 2. Update related caches
			// await updateRelatedGuildCaches(payload);

			// 3. Trigger webhooks if configured
			// await triggerGuildWebhooks(payload);

			WinstonLogger.info({
				message: `Handled guild update: ${payload.guildId}`,
				source: 'RedisPubSubManager:handleGuildUpdate',
			});
		} catch (error) {
			WinstonLogger.error({
				message: `Error handling guild update: ${error}`,
				source: 'RedisPubSubManager:handleGuildUpdate',
			});
		}
	}

	private async handleBetPlaced(payload: BetPlacedPayload): Promise<void> {
		// Pseudo code for bet placed handling
		try {
			// 1. Update bet cache
			// await Cache().set(`bet:${payload.betId}`, payload);

			// 2. Update user betting stats
			// await updateUserBettingStats(payload);

			// 3. Trigger notifications
			// await sendBetPlacedNotification(payload);

			WinstonLogger.info({
				message: `Handled bet placed: ${payload.betId}`,
				source: 'RedisPubSubManager:handleBetPlaced',
			});
		} catch (error) {
			WinstonLogger.error({
				message: `Error handling bet placed: ${error}`,
				source: 'RedisPubSubManager:handleBetPlaced',
			});
		}
	}

	private async handleBetSettled(payload: BetSettledPayload): Promise<void> {
		// Pseudo code for bet settled handling
		try {
			// 1. Update bet status in cache
			// await Cache().set(`bet:${payload.betId}:status`, payload.status);

			// 2. Process payout if WIN
			// if (payload.status === 'WIN') await processPayout(payload);

			// 3. Update user statistics
			// await updateUserBettingHistory(payload);

			// 4. Send notifications
			// await sendBetSettledNotification(payload);

			WinstonLogger.info({
				message: `Handled bet settled: ${payload.betId}`,
				source: 'RedisPubSubManager:handleBetSettled',
			});
		} catch (error) {
			WinstonLogger.error({
				message: `Error handling bet settled: ${error}`,
				source: 'RedisPubSubManager:handleBetSettled',
			});
		}
	}
}

// Export singleton instance
export const redisPubSub = new RedisPubSubManager();
