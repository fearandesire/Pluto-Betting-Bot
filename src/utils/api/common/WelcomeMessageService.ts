import { container } from '@sapphire/framework'
import { EmbedBuilder } from 'discord.js'
import _ from 'lodash'
import pTimeout, { TimeoutError } from 'p-timeout'
import type { CacheManager } from '../../cache/cache-manager.js'
import { logger } from '../../logging/WinstonLogger.js'
import { plutoWelcomeMsg } from './interfaces/kh-pluto/kh-pluto.interface.js'

/**
 * Service for sending welcome messages to new users via Discord DMs.
 * Implements deduplication to prevent multiple welcome messages within 5 minutes.
 * Handles rate limits with exponential backoff and respects retry-after headers.
 *
 * **Rate Limit Behavior:**
 * Rate limit tracking is global per route (DM sending), matching Discord's global per-bot
 * rate limits. When one user triggers a 429, all subsequent DM send attempts are blocked
 * until the retry-after period expires, preventing cascading rate limit violations.
 */
export class WelcomeMessageService {
	private readonly CACHE_KEY_PREFIX = 'new_user_welcome:'
	private readonly GLOBAL_DM_RATE_LIMIT_KEY = 'global_dm_rate_limit:dm_send'
	private readonly BACKOFF_CACHE_PREFIX = 'welcome_backoff:'
	private readonly RETRY_QUEUE_PREFIX = 'welcome_retry:'
	private readonly CACHE_TTL_SECONDS: number
	private readonly DEFAULT_RETRY_AFTER_SECONDS: number
	private readonly MAX_BACKOFF_ATTEMPTS: number
	private readonly MAX_RETRY_AFTER_SECONDS: number
	private readonly MAX_RETRY_ATTEMPTS = 3
	private readonly API_TIMEOUT_MS = 8000

	// Error code handlers: maps Discord error codes to handler functions
	private readonly ERROR_HANDLERS = {
		50007: { reason: 'DMs disabled', shouldCache: true },
		50013: { reason: 'Missing permissions', shouldCache: true },
		50001: { reason: 'Missing access', shouldCache: true },
		40003: { reason: 'Cannot send in channel', shouldCache: true },
		40004: { reason: 'Empty message', shouldCache: true },
	} as const

	constructor(
		private client: typeof container.client,
		private cacheManager: CacheManager,
		options?: {
			cacheTtlSeconds?: number
			defaultRetryAfterSeconds?: number
			maxBackoffAttempts?: number
			maxRetryAfterSeconds?: number
		},
	) {
		this.CACHE_TTL_SECONDS = options?.cacheTtlSeconds ?? 300 // 5 minutes
		this.DEFAULT_RETRY_AFTER_SECONDS =
			options?.defaultRetryAfterSeconds ?? 5
		this.MAX_BACKOFF_ATTEMPTS = options?.maxBackoffAttempts ?? 5
		this.MAX_RETRY_AFTER_SECONDS = options?.maxRetryAfterSeconds ?? 3600 // 1 hour
	}

	/**
	 * Sends a welcome DM to a new user if not already sent recently.
	 * Fire-and-forget pattern - does not block execution.
	 * @param userId - Discord user ID
	 */
	async sendWelcomeMessage(userId: string): Promise<void> {
		// Check deduplication cache
		const cacheKey = `${this.CACHE_KEY_PREFIX}${userId}`
		const cached = await this.cacheManager.get(cacheKey)
		if (cached) {
			logger.debug({
				message: 'Welcome message already sent recently, skipping',
				userId,
			})
			return
		}

		// Fire-and-forget: don't await, handle errors in background
		this.sendWelcomeMessageInternal(userId, cacheKey).catch((error) => {
			logger.error({
				message: 'Failed to send new user welcome message',
				userId,
				error: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
				code:
					error && typeof error === 'object' && 'code' in error
						? String(error.code)
						: undefined,
			})
		})
	}

	/**
	 * Internal method that actually sends the DM and caches the result.
	 * Assumes client is ready (validated by orchestration layer).
	 */
	private async sendWelcomeMessageInternal(
		userId: string,
		cacheKey: string,
	): Promise<void> {
		// Check if we're currently rate-limited globally (Discord rate limits are per-bot)
		const rateLimitActive = await this.cacheManager.get(
			this.GLOBAL_DM_RATE_LIMIT_KEY,
		)
		if (rateLimitActive) {
			await this.scheduleRetry(userId, cacheKey)
			return
		}

		try {
			const user = await this.fetchUserWithTimeout(userId)
			if (!user) {
				logger.error({
					message: 'Failed to fetch user',
					userId,
				})
				return
			}
			const embed = WelcomeMessageService.buildWelcomeEmbed()

			await this.sendMessageWithTimeout(user, embed)
			// Cache successful send with TTL
			await this.cacheManager.set(cacheKey, true, this.CACHE_TTL_SECONDS)
			// Clear any retry/backoff state on success
			await this.clearBackoffState(userId)
			await this.clearRetryState(userId)

			logger.info({
				message: 'Welcome message sent successfully',
				userId,
			})
		} catch (error: unknown) {
			const code =
				typeof error === 'object' && error !== null && 'code' in error
					? Number(error.code)
					: undefined

			// Handle rate limit (429) separately
			if (code === 429) {
				await this.handleRateLimit(error, userId)
				await this.scheduleRetry(userId, cacheKey)
				return
			}

			// Handle timeout errors - re-enqueue for retry
			if (error instanceof TimeoutError) {
				logger.warn({
					message: 'Discord API call timed out, scheduling retry',
					userId,
				})
				await this.scheduleRetry(userId, cacheKey)
				return
			}

			// Handle known error codes
			const handler = code
				? this.ERROR_HANDLERS[code as keyof typeof this.ERROR_HANDLERS]
				: null
			if (handler) {
				logger.warn({
					message: handler.reason.includes('DM')
						? 'Cannot send welcome DM to user'
						: 'Invalid DM send attempt',
					userId,
					code,
					reason: handler.reason,
				})

				if (handler.shouldCache) {
					await this.cacheManager.set(
						cacheKey,
						true,
						this.CACHE_TTL_SECONDS,
					)
				}
				return
			}

			// Re-throw other errors to be caught by outer catch
			throw error
		}
	}

	/**
	 * Handles rate limit errors with retry-after parsing, caching, and exponential backoff.
	 * Uses global rate limit tracking since Discord rate limits are per-bot, not per-user.
	 * @param error - The Discord API error (should be DiscordAPIError with code 429)
	 * @param userId - Discord user ID for backoff tracking context
	 */
	private async handleRateLimit(
		error: unknown,
		userId: string,
	): Promise<void> {
		const retryAfterSeconds = this.parseRetryAfter(error)

		const backoffKey = this.getCacheKey(this.BACKOFF_CACHE_PREFIX, userId)
		const backoffData = await this.cacheManager.get(backoffKey)
		const attemptCount = _.get(backoffData, 'attemptCount', 0) as number

		if (attemptCount >= this.MAX_BACKOFF_ATTEMPTS) {
			logger.warn({
				message:
					'Max backoff attempts reached for welcome message rate limit',
				userId,
				maxAttempts: this.MAX_BACKOFF_ATTEMPTS,
			})
			// Still cache the global rate limit with retryAfterSeconds to prevent immediate retry
			await this.cacheManager.set(
				this.GLOBAL_DM_RATE_LIMIT_KEY,
				true,
				retryAfterSeconds,
			)
			return
		}

		const backoffDelaySeconds =
			retryAfterSeconds * Math.pow(2, attemptCount)
		const backoffTTL = retryAfterSeconds + backoffDelaySeconds

		logger.warn({
			message:
				'Rate limited while sending welcome DM (global rate limit)',
			userId,
			code: 429,
			retryAfterSeconds,
			attemptCount: attemptCount + 1,
			backoffTTL,
		})

		// Use backoffTTL for both global rate limit cache and per-user backoff state
		await this.cacheManager.set(
			this.GLOBAL_DM_RATE_LIMIT_KEY,
			true,
			backoffTTL,
		)
		await this.cacheManager.set(
			backoffKey,
			{ attemptCount: attemptCount + 1 },
			backoffTTL,
		)

		logger.debug({
			message: 'Global rate limit backoff state updated',
			userId,
			attemptCount: attemptCount + 1,
			backoffDelaySeconds,
			backoffTTL,
		})
	}

	/**
	 * Parses retry-after value from Discord API error.
	 * Discord.js DiscordAPIError may have retryAfter in requestData or as a property.
	 * Falls back to safe default if missing or invalid.
	 * @param error - The error object (may be DiscordAPIError)
	 * @returns Retry-after duration in seconds
	 */
	private parseRetryAfter(error: unknown): number {
		const retryAfterMs: number | undefined =
			_.get(error, 'requestData.retryAfter') || _.get(error, 'retryAfter')

		if (_.isNumber(retryAfterMs) && retryAfterMs > 0) {
			const retryAfterSeconds = Math.ceil(retryAfterMs / 1000)
			if (
				retryAfterSeconds > 0 &&
				retryAfterSeconds <= this.MAX_RETRY_AFTER_SECONDS
			) {
				return retryAfterSeconds
			}
		}

		logger.debug({
			message:
				'Using default retry-after value (retry-after missing or invalid)',
			defaultSeconds: this.DEFAULT_RETRY_AFTER_SECONDS,
		})
		return this.DEFAULT_RETRY_AFTER_SECONDS
	}

	/**
	 * Generates a cache key with prefix and userId context.
	 * @param prefix - Cache key prefix
	 * @param userId - Discord user ID
	 * @returns Cache key string
	 */
	private getCacheKey(prefix: string, userId: string): string {
		return `${prefix}${userId}`
	}

	/**
	 * Schedules a retry for a welcome message when rate-limited or timed out.
	 * Uses Redis to track retry attempts and setTimeout for delayed execution.
	 * @param userId - Discord user ID
	 * @param cacheKey - Cache key for deduplication
	 */
	private async scheduleRetry(
		userId: string,
		cacheKey: string,
	): Promise<void> {
		const retryKey = this.getCacheKey(this.RETRY_QUEUE_PREFIX, userId)
		const retryData = await this.cacheManager.get(retryKey)
		const attemptCount = _.get(retryData, 'attemptCount', 0) as number

		if (attemptCount >= this.MAX_RETRY_ATTEMPTS) {
			logger.warn({
				message: 'Max retry attempts reached for welcome message',
				userId,
				maxAttempts: this.MAX_RETRY_ATTEMPTS,
			})
			return
		}

		// Get rate limit TTL to know when to retry
		const rateLimitTTL = await this.getRateLimitTTL()
		const retryDelayMs = Math.max(rateLimitTTL * 1000, 5000) // At least 5 seconds

		// Store retry state
		await this.cacheManager.set(
			retryKey,
			{ attemptCount: attemptCount + 1, scheduledAt: Date.now() },
			Math.ceil(retryDelayMs / 1000) + 60, // TTL slightly longer than delay
		)

		logger.debug({
			message: 'Scheduled welcome message retry',
			userId,
			attemptCount: attemptCount + 1,
			retryDelayMs,
		})

		// Schedule retry
		setTimeout(() => {
			this.sendWelcomeMessage(userId).catch(() => {
				// Errors already logged by sendWelcomeMessage
			})
		}, retryDelayMs)
	}

	/**
	 * Gets the remaining TTL for the global rate limit key.
	 * @returns TTL in seconds, or default if key doesn't exist or has no expiry
	 */
	private async getRateLimitTTL(): Promise<number> {
		try {
			const ttl = await this.cacheManager.cache.ttl(
				this.GLOBAL_DM_RATE_LIMIT_KEY,
			)
			// Redis TTL: -2 = key doesn't exist, -1 = key exists but no expiry
			if (ttl > 0) {
				return ttl
			}
			return this.DEFAULT_RETRY_AFTER_SECONDS
		} catch {
			return this.DEFAULT_RETRY_AFTER_SECONDS
		}
	}

	/**
	 * Clears retry state after successful send.
	 * @param userId - Discord user ID
	 */
	private async clearRetryState(userId: string): Promise<void> {
		await this.cacheManager.remove(
			this.getCacheKey(this.RETRY_QUEUE_PREFIX, userId),
		)
	}

	/**
	 * Fetches a user with timeout protection.
	 * @param userId - Discord user ID
	 * @returns User object or null
	 */
	private async fetchUserWithTimeout(
		userId: string,
	): Promise<Awaited<ReturnType<typeof this.client.users.fetch>> | null> {
		try {
			return await pTimeout(this.client.users.fetch(userId), {
				milliseconds: this.API_TIMEOUT_MS,
			})
		} catch (error) {
			if (error instanceof TimeoutError) {
				throw error
			}
			return null
		}
	}

	/**
	 * Sends a message with timeout protection.
	 * @param user - Discord user object
	 * @param embed - Embed to send
	 */
	private async sendMessageWithTimeout(
		user: Awaited<ReturnType<typeof this.client.users.fetch>>,
		embed: EmbedBuilder,
	): Promise<void> {
		await pTimeout(user.send({ embeds: [embed] }), {
			milliseconds: this.API_TIMEOUT_MS,
		})
	}

	/**
	 * Clears backoff state after successful send.
	 * @param userId - Discord user ID
	 */
	private async clearBackoffState(userId: string): Promise<void> {
		await this.cacheManager.remove(
			this.getCacheKey(this.BACKOFF_CACHE_PREFIX, userId),
		)
	}

	/**
	 * Builds the welcome embed using plutoWelcomeMsg constant.
	 */
	private static buildWelcomeEmbed(): EmbedBuilder {
		return new EmbedBuilder()
			.setTitle('Welcome to Pluto! 🎉')
			.setDescription(plutoWelcomeMsg)
			.setColor(0x5865f2) // Discord blurple
			.setTimestamp()
	}
}
