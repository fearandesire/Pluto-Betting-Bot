// ============================================================================
// Active Props Service - Fetches active outcomes from Khronos
// ============================================================================

import type { DateGroupDto } from '@kh-openapi'
import type PredictionApiWrapper from '../api/Khronos/prediction/predictionApiWrapper.js'
import { logger } from '../logging/WinstonLogger.js'
import type { CachedProp, PropsCacheService } from './PropCacheService.js'

/**
 * Service for managing active outcomes (outcomes with open predictions)
 * Coordinates between Khronos API and cache
 *
 * Note: We cache outcomes (individual Over/Under), not props (pairs).
 * Multiple outcomes share the same market_id (they belong to the same prop).
 */
export class ActivePropsService {
	private predictionApi: PredictionApiWrapper
	private cacheService: PropsCacheService

	constructor(
		predictionApi: PredictionApiWrapper,
		cacheService: PropsCacheService,
	) {
		this.predictionApi = predictionApi
		this.cacheService = cacheService
	}

	/**
	 * Fetch active outcomes from Khronos and cache all outcomes from outcome_uuids array
	 *
	 * Cache all outcomes from outcome_uuids array. Each outcome belongs to a prop (identified by market_id).
	 * Multiple outcomes share the same market_id (they belong to the same prop pair).
	 *
	 * @returns Array of cached outcomes with full metadata
	 */
	async refreshActiveProps(guildId: string): Promise<CachedProp[]> {
		try {
			const apiStartTime = Date.now()
			const dateGroups: DateGroupDto[] =
				await this.predictionApi.getActiveOutcomesGrouped({
					guildId,
				})
			const apiDuration = Date.now() - apiStartTime

			// Extract full outcome metadata from nested structure: DateGroup[] -> Game[] -> Prop[]
			const cachedOutcomes: CachedProp[] = []

			for (const dateGroup of dateGroups) {
				for (const game of dateGroup.games) {
					// Extract game-level fields that apply to all outcomes
					const homeTeam = game.home_team ?? ''
					const awayTeam = game.away_team ?? ''
					const commenceTime = game.commence_time ?? ''

					// Each prop contains multiple outcomes (Over + Under)
					for (const prop of game.props) {
						// Get all outcome UUIDs for this prop (identified by market_id)
						const outcomeUuids = prop.outcome_uuids ?? [
							prop.outcome_uuid,
						]
						const marketId = prop.market_id ?? null

						// Cache each outcome individually (they share the same market_id/prop)
						for (const outcomeUuid of outcomeUuids) {
							cachedOutcomes.push({
								outcome_uuid: outcomeUuid,
								market_id: marketId, // Groups outcomes into prop pairs
								description: prop.description ?? '',
								market_key: prop.market_key ?? '',
								point: prop.point ?? null,
								home_team: homeTeam,
								away_team: awayTeam,
								commence_time: commenceTime,
							})
						}
					}
				}
			}

			// Update cache with full outcome metadata
			const cacheStartTime = Date.now()
			await this.cacheService.cacheActiveProps(cachedOutcomes)
			const cacheDuration = Date.now() - cacheStartTime

			// Log performance metrics
			logger.info('Active outcomes refreshed', {
				guildId,
				outcomesCount: cachedOutcomes.length,
				apiDuration: `${apiDuration}ms`,
				cacheDuration: `${cacheDuration}ms`,
				totalDuration: `${apiDuration + cacheDuration}ms`,
			})

			return cachedOutcomes
		} catch (error) {
			logger.error('Failed to refresh active outcomes', {
				guildId,
				error: error instanceof Error ? error.message : String(error),
			})
			throw new Error(
				`Failed to refresh active outcomes for guild ${guildId}: ${error instanceof Error ? error.message : String(error)}`,
			)
		}
	}

	/**
	 * Get active outcomes with cache fallback
	 * Uses cached data unless forceRefresh is true
	 * Optimized to return cached outcomes directly without extra cache read
	 * Returns one outcome per prop (deduplicated by market_id)
	 *
	 * @returns Object with outcomes array and cache metadata
	 */
	async getActiveProps(
		guildId: string,
		forceRefresh = false,
	): Promise<{ props: CachedProp[]; fromCache: boolean }> {
		// Check cache first unless forced refresh
		if (!forceRefresh) {
			const cached = await this.cacheService.getActiveProps()
			if (cached.length > 0) {
				return { props: cached, fromCache: true }
			}
		}

		// Refresh from API if cache is empty or refresh is forced
		// refreshActiveProps returns all outcomes; deduplicate by market_id before returning
		const allOutcomes = await this.refreshActiveProps(guildId)

		// Deduplicate outcomes by market_id to return one outcome per prop
		// Props are identified by market_id - multiple outcomes share the same market_id
		const deduplicatedOutcomes: CachedProp[] = []
		const marketIdMap = new Map<number, CachedProp>()

		for (const outcome of allOutcomes) {
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

		return { props: deduplicatedOutcomes, fromCache: false }
	}
}
