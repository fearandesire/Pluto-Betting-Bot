// ============================================================================
// Redis Cache Service - Isolated prop caching logic
// ============================================================================

import { z } from 'zod'
import type { CacheManager } from '../cache/cache-manager.js'
import { logger } from '../logging/WinstonLogger.js'

/**
 * Zod schema for validating CachedProp objects
 *
 * Note: We cache outcomes (individual Over/Under), not props (pairs).
 * Multiple outcomes share the same market_id (they belong to the same prop).
 */
export const CachedPropSchema = z.object({
	/** Unique identifier for the outcome (used as Redis hash field key) */
	outcome_uuid: z.string(),
	/** Market ID from Goracle - groups outcomes into prop pairs (e.g., Over/Under share same market_id). Null for legacy data. */
	market_id: z.number().nullable(),
	/** Player or stat description (e.g., "LeBron James Touchdowns") */
	description: z.string(),
	/** Market type identifier (e.g., "player_touchdowns", "player_receptions") */
	market_key: z.string(),
	/** Point/line value for the prop (null if not applicable) */
	point: z.number().nullable(),
	/** Home team name */
	home_team: z.string(),
	/** Away team name */
	away_team: z.string(),
	/** ISO timestamp of when the game commences */
	commence_time: z.string(),
})

/**
 * Represents a cached outcome (individual Over/Under), not a prop pair.
 * Multiple outcomes share the same market_id (they belong to the same prop).
 *
 * Props are identified by market_id - a prop pair (Over/Under) shares the same market_id.
 *
 * @example
 * ```typescript
 * const outcome: CachedProp = {
 *   outcome_uuid: "abc-123-def-456",
 *   market_id: 12345, // Groups this outcome with its pair (same market_id)
 *   description: "LeBron James Touchdowns",
 *   market_key: "player_touchdowns",
 *   point: 2.5,
 *   home_team: "Lakers",
 *   away_team: "Warriors",
 *   commence_time: "2025-01-27T20:00:00Z"
 * };
 * ```
 */
export type CachedProp = z.infer<typeof CachedPropSchema>

/**
 * Service for caching outcomes (individual Over/Under) in Redis
 *
 * Note: We cache outcomes, not props. Multiple outcomes share the same market_id (same prop).
 * Props are identified by market_id - a prop pair (Over/Under) shares the same market_id.
 *
 * **Guild-Scoping:**
 * - `cacheAllProps()` and `getAllProps()` are global (shared across all guilds)
 * - `cacheActiveProps(guildId)` and `getActiveProps(guildId)` are guild-scoped (each guild has separate cache)
 * - Active props cache keys are scoped by guildId: `props:active:${guildId}`
 * - This prevents cross-guild cache contamination when different guilds refresh their active props
 *
 * Uses Redis hash structures for efficient storage and retrieval:
 * - `props:all` - Hash containing all cached outcomes (populated by cron job, global)
 * - `props:active:${guildId}` - Hash containing only outcomes with active predictions for a specific guild (populated on-demand)
 *
 * **Redis Structure:**
 * ```
 * props:all (Hash) - Global
 *   ├─ field: "abc-123-def-456" (outcome UUID)
 *   │  value: '{"outcome_uuid":"abc-123-def-456","market_id":12345,"description":"LeBron James",...}'
 *   └─ ... (more outcomes)
 *
 * props:active:guild123 (Hash) - Guild-scoped
 *   ├─ field: "abc-123-def-456" (outcome UUID)
 *   │  value: '{"outcome_uuid":"abc-123-def-456","market_id":12345,...}'
 *   └─ ... (only outcomes with active predictions for guild123)
 *
 * props:active:guild456 (Hash) - Different guild, separate cache
 *   └─ ... (outcomes with active predictions for guild456)
 * ```
 *
 * **Retrieval Pattern:**
 * - Use `getActiveProps(guildId)` for autocomplete (returns one outcome per prop, deduplicated by market_id)
 * - Use `getActivePropsIds(guildId)` if you only need UUIDs (backward compatibility)
 * - Use `getAllProps()` to get all cached outcomes (from cron job cache, global)
 *
 * @example
 * ```typescript
 * const cacheService = new PropsCacheService(cacheManager);
 *
 * // Cache active outcomes for a specific guild (called when fetching from API)
 * await cacheService.cacheActiveProps('guild123', [
 *   {
 *     outcome_uuid: "abc-123",
 *     market_id: 12345, // Groups outcomes into prop pairs
 *     description: "LeBron James",
 *     market_key: "player_points",
 *     point: 25.5,
 *     home_team: "Lakers",
 *     away_team: "Warriors",
 *     commence_time: "2025-01-27T20:00:00Z"
 *   }
 * ]);
 *
 * // Retrieve active props for a specific guild (for autocomplete) - deduplicated by market_id
 * const activeProps = await cacheService.getActiveProps('guild123');
 * // Returns: CachedProp[] with one outcome per prop (deduplicated by market_id)
 *
 * // Get only UUIDs (if needed)
 * const activeIds = await cacheService.getActivePropsIds('guild123');
 * // Returns: Set<string> with outcome UUIDs
 * ```
 */
export class PropsCacheService {
	private cache: CacheManager
	private readonly ALL_PROPS_KEY = 'props:all'
	private readonly CACHE_TTL = 3600 // 1 hour

	constructor(cache: CacheManager) {
		this.cache = cache
	}

	/**
	 * Get guild-scoped Redis key for active props cache
	 * @param guildId - Discord guild ID
	 * @returns Redis key string: `props:active:${guildId}`
	 */
	private getActivePropsKey(guildId: string): string {
		if (
			!guildId ||
			typeof guildId !== 'string' ||
			guildId.trim().length === 0
		) {
			throw new Error(
				`Invalid guildId provided to PropsCacheService: ${guildId}. Guild ID must be a non-empty string.`,
			)
		}
		return `props:active:${guildId}`
	}

	/**
	 * Store all outcomes in Redis (called by cron job)
	 *
	 * Uses a Redis hash with outcome_uuid as field and JSON-serialized outcome as value.
	 * This cache is populated periodically with random outcomes to improve initial autocomplete response time.
	 * Note: We cache outcomes (individual Over/Under), not props (pairs).
	 *
	 * **Redis Command Sequence:**
	 * 1. `DEL props:all` - Clear existing hash
	 * 2. `HSET props:all <outcome_uuid> <json>` - Store each outcome (batched via pipeline)
	 * 3. `EXPIRE props:all 3600` - Set 1-hour TTL
	 *
	 * @param props - Array of outcomes to cache (typically random outcomes from API)
	 *
	 * @example
	 * ```typescript
	 * const outcomes: CachedProp[] = [
	 *   {
	 *     outcome_uuid: "abc-123",
	 *     market_id: 12345,
	 *     description: "LeBron James",
	 *     market_key: "player_points",
	 *     point: 25.5,
	 *     home_team: "Lakers",
	 *     away_team: "Warriors",
	 *     commence_time: "2025-01-27T20:00:00Z"
	 *   }
	 * ];
	 * await cacheService.cacheAllProps(outcomes);
	 * ```
	 */
	async cacheAllProps(props: CachedProp[]): Promise<void> {
		const pipeline = this.cache.pipeline()

		// Clear existing data
		pipeline.del(this.ALL_PROPS_KEY)

		// Store each prop as a hash with the outcome_uuid as the field
		for (const prop of props) {
			pipeline.hset(
				this.ALL_PROPS_KEY,
				prop.outcome_uuid,
				JSON.stringify(prop),
			)
		}

		pipeline.expire(this.ALL_PROPS_KEY, this.CACHE_TTL)
		await pipeline.exec()
	}

	/**
	 * Get all cached outcomes from Redis hash
	 *
	 * Retrieves all outcomes stored in the `props:all` hash (populated by cron job).
	 * This includes random outcomes cached for performance, not necessarily active outcomes.
	 * Note: We cache outcomes (individual Over/Under), not props (pairs).
	 *
	 * **Redis Command:**
	 * - `HGETALL props:all` - Returns all hash fields and values
	 *
	 * @returns Array of all cached outcomes, or empty array if cache is empty
	 *
	 * @example
	 * ```typescript
	 * const allOutcomes = await cacheService.getAllProps();
	 * // Returns: CachedProp[]
	 * // Example: [
	 * //   {
	 * //     outcome_uuid: "abc-123",
	 * //     market_id: 12345,
	 * //     description: "LeBron James",
	 * //     market_key: "player_points",
	 * //     point: 25.5,
	 * //     home_team: "Lakers",
	 * //     away_team: "Warriors",
	 * //     commence_time: "2025-01-27T20:00:00Z"
	 * //   },
	 * //   ...more outcomes
	 * // ]
	 * ```
	 */
	async getAllProps(): Promise<CachedProp[]> {
		const data = await this.cache.hgetall(this.ALL_PROPS_KEY)
		return Object.values(data).map((json) => JSON.parse(json))
	}

	/**
	 * Cache active outcomes with full metadata (called on-demand when cache miss occurs)
	 *
	 * Stores outcomes that have active predictions in a guild-scoped hash: `props:active:${guildId}`.
	 * This is the primary cache used for autocomplete - it contains only outcomes
	 * with pending predictions for the specified guild, eliminating the need for filtering.
	 * Note: We cache outcomes (individual Over/Under UUIDs), not props (pairs).
	 *
	 * **Guild-Scoping:**
	 * Each guild has its own separate cache to prevent cross-guild contamination.
	 * When Guild A refreshes its active props, it does not affect Guild B's cache.
	 *
	 * **Redis Command Sequence:**
	 * 1. `DEL props:active:${guildId}` - Clear existing hash for this guild
	 * 2. `HSET props:active:${guildId} <outcome_uuid> <json>` - Store each outcome (batched via pipeline)
	 * 3. `EXPIRE props:active:${guildId} 300` - Set 5-minute TTL
	 *
	 * **Performance:** Uses Redis pipeline for atomic batch operations (O(1) per outcome)
	 *
	 * @param guildId - Discord guild ID (required for guild-scoped caching)
	 * @param props - Array of active outcomes with full metadata to cache
	 *
	 * @example
	 * ```typescript
	 * // Called after fetching active outcomes from API for a specific guild
	 * const activeOutcomes: CachedProp[] = [
	 *   {
	 *     outcome_uuid: "abc-123",
	 *     market_id: 12345, // Groups outcomes into prop pairs
	 *     description: "LeBron James",
	 *     market_key: "player_points",
	 *     point: 25.5,
	 *     home_team: "Lakers",
	 *     away_team: "Warriors",
	 *     commence_time: "2025-01-27T20:00:00Z"
	 *   }
	 * ];
	 * await cacheService.cacheActiveProps('guild123', activeOutcomes);
	 *
	 * // Now getActiveProps('guild123') will return one outcome per prop (deduplicated by market_id)
	 * const cached = await cacheService.getActiveProps('guild123');
	 * ```
	 */
	async cacheActiveProps(
		guildId: string,
		props: CachedProp[],
	): Promise<void> {
		// Validate guildId (getActivePropsKey will throw if invalid)
		const activePropsKey = this.getActivePropsKey(guildId)

		// Validate input (allow empty array to clear cache)
		try {
			z.array(CachedPropSchema).parse(props)
		} catch (error) {
			throw new Error(
				`Invalid props data for cacheActiveProps: ${error instanceof Error ? error.message : 'unknown error'}`,
			)
		}

		const pipeline = this.cache.pipeline()

		// Clear existing data for this guild
		pipeline.del(activePropsKey)

		// Store each prop as a hash with the outcome_uuid as the field
		for (const prop of props) {
			pipeline.hset(
				activePropsKey,
				prop.outcome_uuid,
				JSON.stringify(prop),
			)
		}

		// Set 5 min TTL for active props
		pipeline.expire(activePropsKey, 300)
		const results = await pipeline.exec()
		if (results?.some(([err]) => err)) {
			throw new Error(
				`Failed to cache active props for guild ${guildId}: ${results
					.filter(([err]) => err)
					.map(([err]) => err?.message)
					.join(', ')}`,
			)
		}
	}

	/**
	 * Get active outcome IDs from cache (backward compatibility)
	 *
	 * Extracts only the outcome UUIDs from the guild-scoped `props:active:${guildId}` hash.
	 * Useful when you only need to check if an outcome is active, not the full metadata.
	 * Note: We cache outcomes, not props.
	 *
	 * **Guild-Scoping:**
	 * Returns UUIDs only for the specified guild's active props cache.
	 *
	 * **Redis Command:**
	 * - `HGETALL props:active:${guildId}` - Returns all hash fields (keys are UUIDs)
	 *
	 * @param guildId - Discord guild ID (required for guild-scoped caching)
	 * @returns Set of outcome UUIDs, or empty Set if cache is empty
	 *
	 * @example
	 * ```typescript
	 * const activeIds = await cacheService.getActivePropsIds('guild123');
	 * // Returns: Set<string>
	 * // Example: Set { "abc-123", "xyz-789", "def-456" }
	 *
	 * // Check if a specific outcome is active
	 * if (activeIds.has("abc-123")) {
	 *   console.log("Outcome has active predictions");
	 * }
	 * ```
	 */
	async getActivePropsIds(guildId: string): Promise<Set<string>> {
		const activePropsKey = this.getActivePropsKey(guildId)
		const data = await this.cache.hgetall(activePropsKey)
		return new Set(Object.keys(data))
	}

	/**
	 * Get active outcomes directly from cache, deduplicated by market_id
	 *
	 * Primary method for retrieving active outcomes for autocomplete.
	 * Returns one outcome per prop (deduplicated by market_id). Props are identified by market_id.
	 * Multiple outcomes share the same market_id (they belong to the same prop).
	 *
	 * **Guild-Scoping:**
	 * Returns outcomes only from the specified guild's active props cache.
	 * Each guild maintains its own separate cache to prevent cross-guild contamination.
	 *
	 * **Redis Command:**
	 * - `HGETALL props:active:${guildId}` - Returns all hash fields and values for this guild
	 *
	 * **Deduplication Logic:**
	 * - Groups outcomes by market_id
	 * - Returns one outcome per market_id (first occurrence)
	 * - Legacy outcomes without market_id are kept as-is
	 *
	 * **Performance:** Single Redis operation, O(1) lookup per outcome
	 *
	 * @param guildId - Discord guild ID (required for guild-scoped caching)
	 * @returns Array of active outcomes (one per prop), deduplicated by market_id, or empty array if cache is empty
	 *
	 * @example
	 * ```typescript
	 * // Get active outcomes for autocomplete (deduplicated by market_id)
	 * const activeOutcomes = await cacheService.getActiveProps('guild123');
	 *
	 * // Returns: CachedProp[] with one outcome per prop
	 * // Example: [
	 * //   {
	 * //     outcome_uuid: "abc-123",
	 * //     market_id: 12345, // Groups outcomes into prop pairs
	 * //     description: "LeBron James",
	 * //     market_key: "player_points",
	 * //     point: 25.5,
	 * //     home_team: "Lakers",
	 * //     away_team: "Warriors",
	 * //     commence_time: "2025-01-27T20:00:00Z"
	 * //   },
	 * //   ...more outcomes (one per prop)
	 * // ]
	 *
	 * // Use for autocomplete filtering
	 * const filtered = activeOutcomes.filter(outcome =>
	 *   outcome.description.toLowerCase().includes(query.toLowerCase())
	 * );
	 * ```
	 */
	async getActiveProps(guildId: string): Promise<CachedProp[]> {
		const activePropsKey = this.getActivePropsKey(guildId)
		const data = await this.cache.hgetall(activePropsKey)
		if (Object.keys(data).length === 0) {
			return []
		}

		const validatedOutcomes: CachedProp[] = []

		for (const [key, json] of Object.entries(data)) {
			try {
				const parsed = JSON.parse(json)
				const validated = CachedPropSchema.parse(parsed)
				validatedOutcomes.push(validated)
			} catch (error) {
				logger.warn(
					`Failed to parse/validate cached outcome with key ${key} for guild ${guildId}: ${error instanceof Error ? error.message : 'unknown error'}`,
				)
				// Skip invalid entries instead of throwing
			}
		}

		// Deduplicate outcomes by market_id to return one outcome per prop
		// Props are identified by market_id - multiple outcomes share the same market_id
		const deduplicatedOutcomes: CachedProp[] = []
		const marketIdMap = new Map<number, CachedProp>()

		for (const outcome of validatedOutcomes) {
			if (outcome.market_id !== null && outcome.market_id !== undefined) {
				// Group by market_id (prop) - keep first occurrence
				// This ensures autocomplete shows one entry per prop pair
				if (!marketIdMap.has(outcome.market_id)) {
					marketIdMap.set(outcome.market_id, outcome)
					deduplicatedOutcomes.push(outcome)
				}
			} else {
				// Legacy outcomes without market_id - keep all
				deduplicatedOutcomes.push(outcome)
			}
		}

		return deduplicatedOutcomes
	}
}
