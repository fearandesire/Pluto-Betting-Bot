import { format } from 'date-fns'
import PlutoLogger from '@pluto-logger'
import redisCache from './redisInstance.js'

export class CacheManager {
	/**
	 * Creates a new `CacheManager` instance.
	 * @param {string} item - The cache key for the item to be cached.
	 */
	constructor() {
		this.cache = redisCache
	}

	async set(key, data, TTL) {
		if (!key) {
			throw new Error(
				'No key was provided to save into cache',
			)
		}
		const MAX_EXPIRATION = 1800 // Default: 30 Minutes
		await this.cache.set(
			key,
			JSON.stringify(data),
			'EX',
			TTL || MAX_EXPIRATION,
		)
		return true
	}

	async get(key) {
		if (!key) {
			throw new Error(
				'No key was provided to save into cache',
			)
		}
		const item = await this.cache.get(key)
		if (!item) {
			return false
		}
		return JSON.parse(item)
	}

	async getTodaysGames() {
		const currentDate = new Date()
		const formattedDate = format(
			currentDate,
			'yyyy-MM-dd',
		)
		const todaysGames = await this.cache.get(
			formattedDate,
		)
		if (!todaysGames) {
			return false
		}
		return todaysGames
	}

	/**
	 * @method remove
	 * Remove a key from cache
	 * @param {string} key
	 *
	 */
	async remove(key) {
		await this.cache.del(key, async (err) => {
			if (err) {
				await PlutoLogger.log({
					id: 4,
					description: `Error deleting item from Cache`,
				})
				return false
			}
			return true
		})
	}

	/**
	 * Clears all cached data.
	 */
	async clear() {
		await this.cache.flushAll()
		return true
	}
}

export function Cache() {
	return new CacheManager()
}
