import { type FooterConfigResponseDto } from '@kh-openapi'
import {
	createFooterService,
	FooterService,
} from '../../services/api/Khronos/index.js'
import { KH_API_CONFIG } from '../../utils/api/Khronos/KhronosInstances.js'
import { logger } from '../../utils/logging/WinstonLogger.js'
import { FALLBACK_FOOTERS, type FooterTypes } from './fallbackFooters.js'

export class FooterManager {
	private static instance: FooterManager
	private service: FooterService
	private cache: FooterConfigResponseDto | null = null
	private readonly REFRESH_INTERVAL = 5 * 60 * 1000 // 5 minutes
	private _refreshInterval: ReturnType<typeof setInterval> | null = null

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
}
