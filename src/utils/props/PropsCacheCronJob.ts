// ============================================================================
// Cron Job - Periodic cache refresh
// ============================================================================

import { container } from '@sapphire/framework';
import type PropsApiWrapper from '../api/Khronos/props/propsApiWrapper.js';
import type { CachedProp, PropsCacheService } from './PropCacheService.js';

/**
 * Cron job for refreshing props cache periodically
 * Call this via a cron scheduler (e.g., node-cron, bull queue)
 *
 * NOTE: This is optional - the cache will be populated on-demand via autocomplete
 * Pre-caching can improve initial autocomplete response time
 */
export class PropsCacheCronJob {
	private cacheService: PropsCacheService;
	private propsApi: PropsApiWrapper;

	constructor(cacheService: PropsCacheService, propsApi: PropsApiWrapper) {
		this.cacheService = cacheService;
		this.propsApi = propsApi;
	}

	/**
	 * Refresh props cache with random props
	 * Uses getRandomProps to fetch a large sample for caching
	 * This should be called periodically (e.g., every hour) to keep cache fresh
	 *
	 * @param sport - The sport to cache props for
	 * @param count - Number of props to fetch (default: 100)
	 */
	async refreshPropsCache(
		sport: 'nba' | 'nfl',
		count = 100,
	): Promise<void> {
		try {
			container.logger.info('Refreshing props cache', { sport, count });

			// Fetch random props from Khronos (this is the available endpoint)
			const props = await this.propsApi.getRandomProps(sport, count);

			// Transform to cached format
			const cachedProps: CachedProp[] = props.map((prop: any) => ({
				outcome_uuid: prop.outcome_uuid,
				description: prop.description,
				market_key: prop.market_key,
				point: prop.point,
				home_team: prop.home_team,
				away_team: prop.away_team,
				commence_time: prop.commence_time,
			}));

			await this.cacheService.cacheAllProps(cachedProps);

			container.logger.info('Props cache refreshed', {
				sport,
				count: cachedProps.length,
			});
		} catch (error) {
			container.logger.error('Failed to refresh props cache', { sport, error });
			throw error;
		}
	}
}


