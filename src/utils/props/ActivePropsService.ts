// ============================================================================
// Active Props Service - Fetches active outcomes from Khronos
// ============================================================================

import type { DateGroupDto } from '@kh-openapi';
import type PredictionApiWrapper from '../api/Khronos/prediction/predictionApiWrapper.js';
import { logger } from '../logging/WinstonLogger.js';
import type { CachedProp, PropsCacheService } from './PropCacheService.js';

/**
 * Service for managing active props (props with open predictions)
 * Coordinates between Khronos API and cache
 */
export class ActivePropsService {
	private predictionApi: PredictionApiWrapper;
	private cacheService: PropsCacheService;

	constructor(
		predictionApi: PredictionApiWrapper,
		cacheService: PropsCacheService,
	) {
		this.predictionApi = predictionApi;
		this.cacheService = cacheService;
	}

	/**
	 * Fetch active outcomes from Khronos and update cache with full metadata
	 * @returns Array of cached props with full metadata
	 */
	async refreshActiveProps(guildId: string): Promise<CachedProp[]> {
		const apiStartTime = Date.now();
		const dateGroups: DateGroupDto[] = await this.predictionApi.getActiveOutcomesGrouped({ 
			guildId 
		});
		const apiDuration = Date.now() - apiStartTime;

		// Extract full prop metadata from nested structure: DateGroup[] -> Game[] -> Prop[]
		const cachedProps: CachedProp[] = [];
		
		for (const dateGroup of dateGroups) {
			for (const game of dateGroup.games) {
				// Extract game-level fields that apply to all props
				const homeTeam = game.home_team || '';
				const awayTeam = game.away_team || '';
				const commenceTime = game.commence_time || '';

				// Transform each prop to CachedProp format
				for (const prop of game.props) {
					cachedProps.push({
						outcome_uuid: prop.outcome_uuid,
						description: prop.description || '',
						market_key: prop.market_key || '',
						point: prop.point ?? null,
						home_team: homeTeam,
						away_team: awayTeam,
						commence_time: commenceTime,
					});
				}
			}
		}

		// Update cache with full prop metadata
		const cacheStartTime = Date.now();
		await this.cacheService.cacheActiveProps(cachedProps);
		const cacheDuration = Date.now() - cacheStartTime;

		// Log performance metrics
		logger.info('Active props refreshed', {
			guildId,
			propsCount: cachedProps.length,
			apiDuration: `${apiDuration}ms`,
			cacheDuration: `${cacheDuration}ms`,
			totalDuration: `${apiDuration + cacheDuration}ms`,
		});

		return cachedProps;
	}

	/**
	 * Get active props with cache fallback
	 * Uses cached data unless forceRefresh is true
	 * Optimized to return cached props directly without extra cache read
	 */
	async getActiveProps(
		guildId: string,
		forceRefresh = false,
	): Promise<CachedProp[]> {
		// Check cache first unless forced refresh
		if (!forceRefresh) {
			const cached = await this.cacheService.getActiveProps();
			if (cached.length > 0) {
				return cached;
			}
		}

		// Refresh from API if cache is empty or refresh is forced
		// refreshActiveProps already returns the props and updates cache
		return this.refreshActiveProps(guildId);
	}
}