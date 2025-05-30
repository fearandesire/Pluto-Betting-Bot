import { format } from 'date-fns';
import type { Redis } from 'ioredis';
import redisCache from './redis-instance.js';

export class CacheManager {
	cache: Redis;

	constructor() {
		this.cache = redisCache;
	}

	async set(key: string, data: unknown, TTL?: number) {
		if (!key) {
			throw new Error('No key was provided to save into cache');
		}
		const MAX_EXPIRATION = 1800; // Default: 30 Minutes
		await this.cache.set(
			key,
			JSON.stringify(data),
			'EX',
			TTL || MAX_EXPIRATION,
		);
		return true;
	}

	async get(key: string) {
		if (!key) {
			throw new Error('No key was provided to save into cache');
		}
		const item = await this.cache.get(key);
		if (!item) {
			return false;
		}
		return JSON.parse(item);
	}

	async getTodaysGames() {
		const currentDate = new Date();
		const formattedDate = format(currentDate, 'yyyy-MM-dd');
		const todaysGames = await this.cache.get(formattedDate);
		if (!todaysGames) {
			return false;
		}
		return todaysGames;
	}

	async remove(key: string) {
		try {
			await this.cache.del(key);
			return true;
		} catch (err) {
			console.error(`Error removing ${key} from cache`, err);
			return false;
		}
	}

	async clear() {
		await this.cache.flushall();
		return true;
	}
}

export function Cache() {
	return new CacheManager();
}
