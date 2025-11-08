// ============================================================================
// Redis Cache Service - Isolated prop caching logic
// ============================================================================

import type { CacheManager } from '../cache/cache-manager.js';

/**
 * Represents a cached prop with essential metadata for autocomplete and display
 *
 * @example
 * ```typescript
 * const prop: CachedProp = {
 *   outcome_uuid: "abc-123-def-456",
 *   description: "LeBron James Touchdowns",
 *   market_key: "player_touchdowns",
 *   point: 2.5,
 *   home_team: "Lakers",
 *   away_team: "Warriors",
 *   commence_time: "2025-01-27T20:00:00Z"
 * };
 * ```
 */
export interface CachedProp {
	/** Unique identifier for the outcome (used as Redis hash field key) */
	outcome_uuid: string;
	/** Player or stat description (e.g., "LeBron James Touchdowns") */
	description: string;
	/** Market type identifier (e.g., "player_touchdowns", "player_receptions") */
	market_key: string;
	/** Point/line value for the prop (null if not applicable) */
	point: number | null;
	/** Home team name */
	home_team: string;
	/** Away team name */
	away_team: string;
	/** ISO timestamp of when the game commences */
	commence_time: string;
}

/**
 * Service for caching player props in Redis
 *
 * Uses Redis hash structures for efficient storage and retrieval:
 * - `props:all` - Hash containing all cached props (populated by cron job)
 * - `props:active` - Hash containing only props with active predictions (populated on-demand)
 *
 * **Redis Structure:**
 * ```
 * props:all (Hash)
 *   ├─ field: "abc-123-def-456"
 *   │  value: '{"outcome_uuid":"abc-123-def-456","description":"LeBron James Touchdowns",...}'
 *   ├─ field: "xyz-789-ghi-012"
 *   │  value: '{"outcome_uuid":"xyz-789-ghi-012","description":"Player Receptions",...}'
 *   └─ ... (more props)
 *
 * props:active (Hash)
 *   ├─ field: "abc-123-def-456"
 *   │  value: '{"outcome_uuid":"abc-123-def-456","description":"LeBron James Touchdowns",...}'
 *   └─ ... (only props with active predictions)
 * ```
 *
 * **Retrieval Pattern:**
 * - Use `getActiveProps()` for autocomplete (returns full CachedProp objects)
 * - Use `getActivePropsIds()` if you only need UUIDs (backward compatibility)
 * - Use `getAllProps()` to get all cached props (from cron job cache)
 *
 * @example
 * ```typescript
 * const cacheService = new PropsCacheService(cacheManager);
 *
 * // Cache active props (called when fetching from API)
 * await cacheService.cacheActiveProps([
 *   {
 *     outcome_uuid: "abc-123",
 *     description: "LeBron James Touchdowns",
 *     market_key: "player_touchdowns",
 *     point: 2.5,
 *     home_team: "Lakers",
 *     away_team: "Warriors",
 *     commence_time: "2025-01-27T20:00:00Z"
 *   }
 * ]);
 *
 * // Retrieve active props (for autocomplete)
 * const activeProps = await cacheService.getActiveProps();
 * // Returns: CachedProp[] with all props that have active predictions
 *
 * // Get only UUIDs (if needed)
 * const activeIds = await cacheService.getActivePropsIds();
 * // Returns: Set<string> with outcome UUIDs
 * ```
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
	 *
	 * Uses a Redis hash with outcome_uuid as field and JSON-serialized prop as value.
	 * This cache is populated periodically with random props to improve initial autocomplete response time.
	 *
	 * **Redis Command Sequence:**
	 * 1. `DEL props:all` - Clear existing hash
	 * 2. `HSET props:all <outcome_uuid> <json>` - Store each prop (batched via pipeline)
	 * 3. `EXPIRE props:all 3600` - Set 1-hour TTL
	 *
	 * @param props - Array of props to cache (typically random props from API)
	 *
	 * @example
	 * ```typescript
	 * const props: CachedProp[] = [
	 *   {
	 *     outcome_uuid: "abc-123",
	 *     description: "LeBron James Touchdowns",
	 *     market_key: "player_touchdowns",
	 *     point: 2.5,
	 *     home_team: "Lakers",
	 *     away_team: "Warriors",
	 *     commence_time: "2025-01-27T20:00:00Z"
	 *   }
	 * ];
	 * await cacheService.cacheAllProps(props);
	 * ```
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
	 *
	 * Retrieves all props stored in the `props:all` hash (populated by cron job).
	 * This includes random props cached for performance, not necessarily active props.
	 *
	 * **Redis Command:**
	 * - `HGETALL props:all` - Returns all hash fields and values
	 *
	 * @returns Array of all cached props, or empty array if cache is empty
	 *
	 * @example
	 * ```typescript
	 * const allProps = await cacheService.getAllProps();
	 * // Returns: CachedProp[]
	 * // Example: [
	 * //   {
	 * //     outcome_uuid: "abc-123",
	 * //     description: "LeBron James Touchdowns",
	 * //     market_key: "player_touchdowns",
	 * //     point: 2.5,
	 * //     home_team: "Lakers",
	 * //     away_team: "Warriors",
	 * //     commence_time: "2025-01-27T20:00:00Z"
	 * //   },
	 * //   ...more props
	 * // ]
	 * ```
	 */
	async getAllProps(): Promise<CachedProp[]> {
		const data = await this.cache.hgetall(this.ALL_PROPS_KEY);
		return Object.values(data).map((json) => JSON.parse(json));
	}

	/**
	 * Cache active props with full metadata (called on-demand when cache miss occurs)
	 *
	 * Stores props that have active predictions in the `props:active` hash.
	 * This is the primary cache used for autocomplete - it contains only props
	 * with pending predictions, eliminating the need for filtering.
	 *
	 * **Redis Command Sequence:**
	 * 1. `DEL props:active` - Clear existing hash
	 * 2. `HSET props:active <outcome_uuid> <json>` - Store each prop (batched via pipeline)
	 * 3. `EXPIRE props:active 300` - Set 5-minute TTL
	 *
	 * **Performance:** Uses Redis pipeline for atomic batch operations (O(1) per prop)
	 *
	 * @param props - Array of active props with full metadata to cache
	 *
	 * @example
	 * ```typescript
	 * // Called after fetching active outcomes from API
	 * const activeProps: CachedProp[] = [
	 *   {
	 *     outcome_uuid: "abc-123",
	 *     description: "LeBron James Touchdowns",
	 *     market_key: "player_touchdowns",
	 *     point: 2.5,
	 *     home_team: "Lakers",
	 *     away_team: "Warriors",
	 *     commence_time: "2025-01-27T20:00:00Z"
	 *   }
	 * ];
	 * await cacheService.cacheActiveProps(activeProps);
	 *
	 * // Now getActiveProps() will return these props immediately
	 * const cached = await cacheService.getActiveProps();
	 * ```
	 */
	async cacheActiveProps(props: CachedProp[]): Promise<void> {
		const pipeline = this.cache.pipeline();

		// Clear existing data
		pipeline.del(this.ACTIVE_PROPS_KEY);

		// Store each prop as a hash with the outcome_uuid as the field
		for (const prop of props) {
			pipeline.hset(
				this.ACTIVE_PROPS_KEY,
				prop.outcome_uuid,
				JSON.stringify(prop),
			);
		}

		// Set 5 min TTL for active props
		pipeline.expire(this.ACTIVE_PROPS_KEY, 300);
		await pipeline.exec();
	}

	/**
	 * Get active prop IDs from cache (backward compatibility)
	 *
	 * Extracts only the outcome UUIDs from the `props:active` hash.
	 * Useful when you only need to check if a prop is active, not the full metadata.
	 *
	 * **Redis Command:**
	 * - `HGETALL props:active` - Returns all hash fields (keys are UUIDs)
	 *
	 * @returns Set of outcome UUIDs, or empty Set if cache is empty
	 *
	 * @example
	 * ```typescript
	 * const activeIds = await cacheService.getActivePropsIds();
	 * // Returns: Set<string>
	 * // Example: Set { "abc-123", "xyz-789", "def-456" }
	 *
	 * // Check if a specific prop is active
	 * if (activeIds.has("abc-123")) {
	 *   console.log("Prop has active predictions");
	 * }
	 * ```
	 */
	async getActivePropsIds(): Promise<Set<string>> {
		const data = await this.cache.hgetall(this.ACTIVE_PROPS_KEY);
		return new Set(Object.keys(data));
	}

	/**
	 * Get active props directly from cache
	 *
	 * Primary method for retrieving active props for autocomplete.
	 * Returns all props stored in the `props:active` hash with full metadata.
	 * No filtering needed - the hash contains only props with active predictions.
	 *
	 * **Redis Command:**
	 * - `HGETALL props:active` - Returns all hash fields and values
	 *
	 * **Performance:** Single Redis operation, O(1) lookup per prop
	 *
	 * @returns Array of active props with full metadata, or empty array if cache is empty
	 *
	 * @example
	 * ```typescript
	 * // Get active props for autocomplete
	 * const activeProps = await cacheService.getActiveProps();
	 *
	 * // Returns: CachedProp[]
	 * // Example: [
	 * //   {
	 * //     outcome_uuid: "abc-123",
	 * //     description: "LeBron James Touchdowns",
	 * //     market_key: "player_touchdowns",
	 * //     point: 2.5,
	 * //     home_team: "Lakers",
	 * //     away_team: "Warriors",
	 * //     commence_time: "2025-01-27T20:00:00Z"
	 * //   },
	 * //   ...more active props
	 * // ]
	 *
	 * // Use for autocomplete filtering
	 * const filtered = activeProps.filter(prop =>
	 *   prop.description.toLowerCase().includes(query.toLowerCase())
	 * );
	 * ```
	 */
	async getActiveProps(): Promise<CachedProp[]> {
		const data = await this.cache.hgetall(this.ACTIVE_PROPS_KEY);
		if (Object.keys(data).length === 0) {
			return [];
		}
		return Object.values(data).map((json) => JSON.parse(json) as CachedProp);
	}
}