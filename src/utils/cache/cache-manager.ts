import { format } from 'date-fns'
import type { ChainableCommander, Redis } from 'ioredis'
import redisCache from './redis-instance.js'

export class CacheManager {
	cache: Redis

	constructor() {
		this.cache = redisCache
	}

	async set(key: string, data: unknown, TTL?: number) {
		if (!key) {
			throw new Error('No key was provided to save into cache')
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

	async get(key: string) {
		if (!key) {
			throw new Error('No key was provided to save into cache')
		}
		const item = await this.cache.get(key)
		if (!item) {
			return false
		}
		return JSON.parse(item)
	}

	async getTodaysGames() {
		const currentDate = new Date()
		const formattedDate = format(currentDate, 'yyyy-MM-dd')
		const todaysGames = await this.cache.get(formattedDate)
		if (!todaysGames) {
			return false
		}
		return todaysGames
	}

	async remove(key: string) {
		try {
			await this.cache.del(key)
			return true
		} catch (err) {
			console.error(`Error removing ${key} from cache`, err)
			return false
		}
	}

	async clear() {
		await this.cache.flushall()
		return true
	}

	// ============================================================================
	// Extended Redis Operations for Prop Caching
	// ============================================================================

	/**
	 * Create a Redis pipeline for batched operations
	 */
	pipeline(): ChainableCommander {
		return this.cache.pipeline()
	}

	/**
	 * Set a field in a Redis hash
	 */
	async hset(key: string, field: string, value: string): Promise<number> {
		return this.cache.hset(key, field, value)
	}

	/**
	 * Get all fields and values from a Redis hash
	 */
	async hgetall(key: string): Promise<Record<string, string>> {
		return this.cache.hgetall(key)
	}

	/**
	 * Delete one or more keys
	 */
	async del(...keys: string[]): Promise<number> {
		return this.cache.del(...keys)
	}

	/**
	 * Add members to a Redis set
	 */
	async sadd(key: string, ...members: string[]): Promise<number> {
		return this.cache.sadd(key, ...members)
	}

	/**
	 * Get all members of a Redis set
	 */
	async smembers(key: string): Promise<string[]> {
		return this.cache.smembers(key)
	}

	/**
	 * Set a key's time to live in seconds
	 */
	async expire(key: string, seconds: number): Promise<number> {
		return this.cache.expire(key, seconds)
	}
}

export function Cache() {
	return new CacheManager()
}
