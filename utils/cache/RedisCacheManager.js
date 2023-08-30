import { format } from 'date-fns'
import redisCache from './redisInstance.js'
import PlutoLogger from '#PlutoLogger'

export class CacheManager {
	/**
	 * Creates a new `CacheManager` instance.
	 * @param {string} item - The cache key for the item to be cached.
	 */
	constructor() {
		this.cache = redisCache
	}

	async set(key, data) {
		if (!key) {
			throw new Error(
				'No key was provided to save into cache',
			)
		}
		const MAX_EXPIRATION = 2147483647 // TTL of cached item
		await this.cache.set(
			key,
			JSON.stringify(data),
			'EX',
			MAX_EXPIRATION,
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
	 * Method to remove a key from the cache
	 */
	async remove(key) {
		await this.cache.del(key, async (err) => {
			if (err) {
				await PlutoLogger.log({
					id: 4,
					description: `Error deleting item from Cache`,
				})
			} else {
				return true
			}
		})
	}

	/**
	 * Clears all cached data.
	 */
	clear() {
		this.cache.flushAll()
		return true
	}
}

export default function Cache() {
	return new CacheManager()
}
