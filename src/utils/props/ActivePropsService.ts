// ============================================================================
// Active Props Service - Fetches active outcomes from Khronos
// ============================================================================

import type { DateGroupDto } from '@kh-openapi';
import type PredictionApiWrapper from '../api/Khronos/prediction/predictionApiWrapper.js';
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
	 * Fetch active outcomes from Khronos and update cache
	 * @returns Array of active outcome UUIDs
	 */
	async refreshActiveProps(guildId: string): Promise<string[]> {
		const dateGroups: DateGroupDto[] = await this.predictionApi.getActiveOutcomesGrouped({ 
			guildId 
		});

		// Flatten nested structure: DateGroup[] -> Game[] -> Prop[]
		const outcomeUuids: string[] = [];
		
		for (const dateGroup of dateGroups) {
			for (const game of dateGroup.games) {
				for (const prop of game.props) {
					outcomeUuids.push(prop.outcome_uuid);
				}
			}
		}

		// Update cache with active prop IDs
		await this.cacheService.cacheActiveProps(outcomeUuids);

		return outcomeUuids;
	}

	/**
	 * Get active props with cache fallback
	 * Uses cached data unless forceRefresh is true
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
		await this.refreshActiveProps(guildId);
		return this.cacheService.getActiveProps();
	}
}