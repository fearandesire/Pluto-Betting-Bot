// ============================================================================
// Redis Cache Service - Isolated prop caching logic
// ============================================================================

import type { CacheManager } from '../cache/cache-manager.js';

/**
 * Represents a cached prop with essential metadata for autocomplete and display
 */
export interface CachedProp {
	outcome_uuid: string;
	description: string;
	market_key: string;
	point: number | null;
	home_team: string;
	away_team: string;
	commence_time: string;
}

/**
 * Service for caching player props in Redis
 * Uses Redis hash for all props and set for active prop IDs
 */
export class PropsCacheService {
	private cache: CacheManager;
	private readonly ALL_PROPS_KEY = 'props:all';
	private readonly ACTIVE_PROPS_KEY = 'props:active';
	private readonly CACHE_TTL = 3600; // 1 hour

	constructor(cache: CacheManager) {
		this.cache = cache;
	}

	/**
	 * Store all props in Redis (called by cron job)
	 * Uses a Redis hash with outcome_uuid as field and JSON as value
	 */
	async cacheAllProps(props: CachedProp[]): Promise<void> {
		const pipeline = this.cache.pipeline();

		// Clear existing data
		pipeline.del(this.ALL_PROPS_KEY);

		// Store each prop as a hash with the outcome_uuid as the field
		for (const prop of props) {
			pipeline.hset(this.ALL_PROPS_KEY, prop.outcome_uuid, JSON.stringify(prop));
		}

		pipeline.expire(this.ALL_PROPS_KEY, this.CACHE_TTL);
		await pipeline.exec();
	}

	/**
	 * Get all cached props from Redis hash
	 */
	async getAllProps(): Promise<CachedProp[]> {
		const data = await this.cache.hgetall(this.ALL_PROPS_KEY);
		return Object.values(data).map((json) => JSON.parse(json));
	}

	/**
	 * Cache active prop IDs (called on-demand or by cron)
	 * Uses a Redis set for efficient membership checking
	 */
	async cacheActiveProps(outcomeUuids: string[]): Promise<void> {
		const pipeline = this.cache.pipeline();

		pipeline.del(this.ACTIVE_PROPS_KEY);

		if (outcomeUuids.length > 0) {
			pipeline.sadd(this.ACTIVE_PROPS_KEY, ...outcomeUuids);
		}

		pipeline.expire(this.ACTIVE_PROPS_KEY, 300); // 5 min TTL for active props
		await pipeline.exec();
	}

	/**
	 * Get active prop IDs from cache
	 */
	async getActivePropsIds(): Promise<Set<string>> {
		const ids = await this.cache.smembers(this.ACTIVE_PROPS_KEY);
		return new Set(ids);
	}

	/**
	 * Filter cached props by active IDs
	 * Returns only props that have active predictions
	 */
	async getActiveProps(): Promise<CachedProp[]> {
		const [allProps, activeIds] = await Promise.all([
			this.getAllProps(),
			this.getActivePropsIds(),
		]);

		return allProps.filter((prop) => activeIds.has(prop.outcome_uuid));
	}
}