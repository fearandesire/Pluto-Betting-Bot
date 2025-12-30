import { type FooterConfigResponseDto } from '@kh-openapi'
import {
	createFooterService,
	FooterService,
} from '../../services/api/Khronos/index.js'
import { KH_API_CONFIG } from '../../utils/api/Khronos/KhronosInstances.js'
import { logger } from '../../utils/logging/WinstonLogger.js'
import { FALLBACK_FOOTERS, type FooterTypes } from './fallbackFooters.js'

export type BetContext = {
	balance: number
	betAmount: number
	odds?: number
}

export class FooterManager {
	private static instance: FooterManager
	private service: FooterService
	private cache: FooterConfigResponseDto | null = null
	private readonly REFRESH_INTERVAL = 5 * 60 * 1000 // 5 minutes
	private _refreshInterval: ReturnType<typeof setInterval> | null = null
	private lastRefresh: Date | null = null

	private constructor() {
		this.service = createFooterService(KH_API_CONFIG, logger)
	}

	public static getInstance(): FooterManager {
		if (!FooterManager.instance) {
			FooterManager.instance = new FooterManager()
		}
		return FooterManager.instance
	}

	async init() {
		await this.refreshConfig()
		this._refreshInterval = setInterval(
			() => this.refreshConfig(),
			this.REFRESH_INTERVAL,
		)
		logger.info({
			message: 'FooterManager initialized',
			metadata: {
				source: 'FooterManager.init',
			},
		})
	}

	/**
	 * Stops the refresh interval and cleans up resources.
	 * Call this during graceful shutdown.
	 */
	stop() {
		if (this._refreshInterval) {
			clearInterval(this._refreshInterval)
			this._refreshInterval = null
		}
	}

	private async refreshConfig() {
		const result = await this.service.getFooterConfig()

		if (result.success) {
			this.cache = result.data
			this.lastRefresh = new Date()
			logger.debug({
				message: 'Footer config refreshed',
				metadata: {
					source: 'FooterManager.refreshConfig',
					categories: Object.keys(result.data.categories).length,
					hasAnnouncement: !!result.data.announcement?.isActive,
				},
			})
		}
		// Error logging is handled by FooterService - just silently use cache/fallback
	}

	getFooter(type: FooterTypes = 'core'): string {
		// 1. Check Announcement (Global Override)
		if (this.cache?.announcement?.isActive) {
			return this.cache.announcement.text
		}

		// 2. Check Cache
		let pool: string[] = []

		if (this.cache) {
			if (type === 'all') {
				// Collect all texts from all categories
				pool = Object.values(this.cache.categories).flat()
			} else {
				const cachedCat = this.cache.categories[type]
				if (cachedCat && cachedCat.length > 0) {
					pool = cachedCat
				}
			}
		}

		if (pool.length > 0) {
			return this.pickRandom(pool)
		}

		// 3. Fallback
		if (type === 'all') {
			const allFallback = Object.values(FALLBACK_FOOTERS).flat()
			return this.pickRandom(allFallback)
		}

		// @ts-ignore - Types should match but safety first
		const fallbackArr = FALLBACK_FOOTERS[type]
		return this.pickRandom(fallbackArr || FALLBACK_FOOTERS.core)
	}

	/**
	 * Selects a random element from the given array.
	 * @param arr - Array of strings; if null/undefined or empty, the function returns an empty string.
	 * @returns A random element from arr, or '' when arr is empty or falsy.
	 */
	private pickRandom(arr: readonly string[]): string {
		if (!arr || arr.length === 0) return ''
		return arr[Math.floor(Math.random() * arr.length)]
	}

	/**
	 * Get a context-aware footer for betting scenarios
	 * @param context - Bet context including balance, bet amount, and optional odds
	 * @returns Footer string based on bet context
	 */
	getFooterForBet(context: BetContext): string {
		// 1. Announcement always wins
		if (this.cache?.announcement?.isActive) {
			return this.cache.announcement.text
		}

		// 2. Context-triggered categories (fast O(1) checks)
		const betRatio = context.betAmount / context.balance

		if (betRatio >= 0.8) {
			return (
				this.pickFromCategory('highBetPlaced') ??
				this.pickFromCategory('placedBet')
			)
		}

		if (betRatio <= 0.05) {
			return (
				this.pickFromCategory('lowBetPlaced') ??
				this.pickFromCategory('placedBet')
			)
		}

		if (context.odds && context.odds >= 5.0) {
			// Underdog bet - use betting category with underdog-themed footers
			return (
				this.pickFromCategory('betting') ??
				this.pickFromCategory('placedBet')
			)
		}

		// 3. Default placed_bet category
		return (
			this.pickFromCategory('placedBet') ?? this.getFallback('placedBet')
		)
	}

	/**
	 * Pick a random footer from a specific category
	 * @param category - Footer category to pick from
	 * @returns Random footer from category or null if empty
	 */
	private pickFromCategory(category: FooterTypes): string | null {
		if (!this.cache) return null
		const pool =
			this.cache.categories[
				category as keyof typeof this.cache.categories
			]
		if (!pool || pool.length === 0) return null
		return this.pickRandom(pool)
	}

	/**
	 * Get fallback footer when cache is unavailable
	 * @param type - Footer type to fallback to
	 * @returns Fallback footer string
	 */
	private getFallback(type: FooterTypes): string {
		const fallbackArr =
			FALLBACK_FOOTERS[type as keyof typeof FALLBACK_FOOTERS]
		return this.pickRandom(fallbackArr || FALLBACK_FOOTERS.core)
	}

	/**
	 * Get cache status information for admin commands
	 * @returns Object with cache metadata
	 */
	getCacheStatus() {
		const now = new Date()
		const nextRefresh = this.lastRefresh
			? new Date(this.lastRefresh.getTime() + this.REFRESH_INTERVAL)
			: null
		const timeToNextRefresh = nextRefresh
			? Math.max(
					0,
					Math.floor(
						(nextRefresh.getTime() - now.getTime()) / 1000 / 60,
					),
				)
			: 0

		const categoryCounts: Record<string, number> = {}
		if (this.cache) {
			for (const [category, footers] of Object.entries(
				this.cache.categories,
			)) {
				categoryCounts[category] = footers.length
			}
		}

		return {
			lastRefresh: this.lastRefresh,
			nextRefresh,
			timeToNextRefresh: `${timeToNextRefresh} minutes`,
			ttl: `${this.REFRESH_INTERVAL / 1000 / 60} minutes`,
			categoryCounts,
			hasAnnouncement: !!this.cache?.announcement?.isActive,
			cacheSize: this.cache
				? Object.values(this.cache.categories).reduce(
						(sum, arr) => sum + arr.length,
						0,
					)
				: 0,
		}
	}

	/**
	 * Force an immediate refresh of the footer cache
	 * Used by admin commands
	 */
	async forceRefresh(): Promise<boolean> {
		try {
			await this.refreshConfig()
			return this.cache !== null
		} catch (error) {
			logger.error({
				message: 'Failed to force refresh footer cache',
				metadata: {
					source: 'FooterManager.forceRefresh',
					error: error instanceof Error ? error.stack : error,
				},
			})
			return false
		}
	}
}
