// ============================================================================
// Active Props Service - Fetches active outcomes from Khronos
// ============================================================================

import type { DateGroupDto } from '@kh-openapi'
import type PredictionApiWrapper from '../api/Khronos/prediction/predictionApiWrapper.js'
import { isValidUUID } from '../common/uuid-validation.js'
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
			const invalidUuids: Array<{
				outcome_uuid: string
				outcome_uuid_type?: string
				outcome_uuid_length?: number
				prop_description?: string
				market_key?: string
				market_id?: number | null
			}> = []

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
							// Validate UUID format before caching
							if (!isValidUUID(outcomeUuid)) {
								invalidUuids.push({
									outcome_uuid: outcomeUuid,
									outcome_uuid_type: typeof outcomeUuid,
									outcome_uuid_length: outcomeUuid?.length,
									prop_description: prop.description,
									market_key: prop.market_key,
									market_id: marketId,
								})
								logger.warn(
									'Invalid UUID format in API response',
									{
										outcome_uuid: outcomeUuid,
										outcome_uuid_type: typeof outcomeUuid,
										outcome_uuid_length:
											outcomeUuid?.length,
										description: prop.description,
										market_key: prop.market_key,
										market_id: marketId,
										guildId,
										context:
											'ActivePropsService.refreshActiveProps',
									},
								)
								continue
							}

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

			if (invalidUuids.length > 0) {
				logger.error('Invalid UUIDs filtered from active props cache', {
					guildId,
					invalid_count: invalidUuids.length,
					total_outcomes: cachedOutcomes.length,
					invalid_uuids: invalidUuids,
					context: 'ActivePropsService.refreshActiveProps',
				})
			}

			// Update cache with full outcome metadata (guild-scoped)
			const cacheStartTime = Date.now()
			await this.cacheService.cacheActiveProps(guildId, cachedOutcomes)
			const cacheDuration = Date.now() - cacheStartTime

			// Log performance metrics and data quality
			logger.info('Active outcomes refreshed', {
				guildId,
				outcomesCount: cachedOutcomes.length,
				invalidUuidsFiltered: invalidUuids.length,
				apiDuration: `${apiDuration}ms`,
				cacheDuration: `${cacheDuration}ms`,
				totalDuration: `${apiDuration + cacheDuration}ms`,
				context: 'ActivePropsService.refreshActiveProps',
			})

			return cachedOutcomes
		} catch (error) {
			logger.error('Failed to refresh active outcomes', {
				guildId,
				error: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
				context: 'ActivePropsService.refreshActiveProps',
			})
			throw new Error(
				`Failed to refresh active outcomes for guild ${guildId}: ${error instanceof Error ? error.message : String(error)}`,
			)
		}
	}

	/**
	 * Get active outcomes with cache fallback
	 * Uses cached data unless forceRefresh is true
	 * Returns one outcome per prop (deduplicated by market_id via PropCacheService)
	 *
	 * @returns Object with outcomes array and cache metadata
	 */
	async getActiveProps(
		guildId: string,
		forceRefresh = false,
	): Promise<{ props: CachedProp[]; fromCache: boolean }> {
		// Check cache first unless forced refresh
		if (!forceRefresh) {
			const cached = await this.cacheService.getActiveProps(guildId)
			if (cached.length > 0) {
				return { props: cached, fromCache: true }
			}
		}

		// Refresh from API if cache is empty or refresh is forced
		// refreshActiveProps caches all outcomes, then we retrieve deduplicated results from cache
		await this.refreshActiveProps(guildId)

		// Retrieve deduplicated outcomes from cache (PropCacheService.getActiveProps handles deduplication)
		const deduplicatedOutcomes =
			await this.cacheService.getActiveProps(guildId)

		return { props: deduplicatedOutcomes, fromCache: false }
	}
}
