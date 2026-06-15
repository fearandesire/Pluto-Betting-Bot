// ============================================================================
// Props Cron Service - Scheduled caching of props from Khronos
// ============================================================================

import type PropsApiWrapper from '../api/Khronos/props/props-api-wrapper.js'
import { logger } from '../logging/WinstonLogger.js'
import type { ActivePropsService } from '../props/ActivePropsService.js'
import type {
	CachedProp,
	PropsCacheService,
} from '../props/PropCacheService.js'
import { convertFlatPropsToCachedProps } from '../props/prop-conversion.js'

/**
 * Service for running scheduled prop caching jobs
 * Fetches props from Khronos and caches them in Redis
 */
export class PropsCronService {
	private propsApi: PropsApiWrapper
	private cacheService: PropsCacheService
	private activePropsService: ActivePropsService
	private readonly SPORTS: Array<'nba' | 'nfl'> = ['nba', 'nfl']

	constructor(
		propsApi: PropsApiWrapper,
		cacheService: PropsCacheService,
		activePropsService: ActivePropsService,
	) {
		this.propsApi = propsApi
		this.cacheService = cacheService
		this.activePropsService = activePropsService
	}

	/**
	 * Main job: Fetch props from Khronos and cache them
	 * Runs periodically to keep prop cache fresh
	 */
	async cacheAllProps(): Promise<void> {
		try {
			await logger.info({
				message: 'Starting props caching job',
				metadata: {
					source: `${this.constructor.name}.${this.cacheAllProps.name}`,
				},
			})

			const allProps: CachedProp[] = []

			// Fetch props for each sport
			for (const sport of this.SPORTS) {
				const props = await this.fetchPropsForSport(sport)
				allProps.push(...props)
			}

			// Filter for upcoming/incomplete props only
			const upcomingProps = this.filterUpcomingProps(allProps)

			await logger.info({
				message: `Filtered ${upcomingProps.length} upcoming props from ${allProps.length} total`,
				metadata: {
					source: `${this.constructor.name}.${this.cacheAllProps.name}`,
					total: allProps.length,
					upcoming: upcomingProps.length,
				},
			})

			// Cache all upcoming props
			await this.cacheService.cacheAllProps(upcomingProps)

			await logger.info({
				message: `Successfully cached ${upcomingProps.length} props`,
				metadata: {
					source: `${this.constructor.name}.${this.cacheAllProps.name}`,
					count: upcomingProps.length,
				},
			})
		} catch (error) {
			await logger.error({
				message: 'Failed to cache props',
				metadata: {
					source: `${this.constructor.name}.${this.cacheAllProps.name}`,
					error:
						error instanceof Error ? error.message : String(error),
				},
			})
			throw error
		}
	}

	/**
	 * Fetch ALL available props for a specific sport from Khronos (no count limit)
	 */
	private async fetchPropsForSport(
		sport: 'nba' | 'nfl',
	): Promise<CachedProp[]> {
		try {
			const availableProps = await this.propsApi.getAvailableProps(sport)

			await logger.debug({
				message: `Fetched ${availableProps.length} available props for ${sport}`,
				metadata: {
					source: `${this.constructor.name}.${this.fetchPropsForSport.name}`,
					sport,
					count: availableProps.length,
				},
			})

			// Convert flat PropDto array to CachedProp format
			return convertFlatPropsToCachedProps(availableProps)
		} catch (error) {
			await logger.error({
				message: `Failed to fetch props for ${sport}`,
				metadata: {
					source: `${this.constructor.name}.${this.fetchPropsForSport.name}`,
					sport,
					error:
						error instanceof Error ? error.message : String(error),
				},
			})
			// Return empty array instead of throwing to allow other sports to continue
			return []
		}
	}

	/**
	 * Filter props to only include upcoming games
	 * Excludes props for games that have already started
	 */
	private filterUpcomingProps(props: CachedProp[]): CachedProp[] {
		const now = new Date()
		return props.filter((prop) => {
			const commenceTime = new Date(prop.commence_time)
			return commenceTime > now
		})
	}

	/**
	 * Secondary job: Cache active props (props with predictions)
	 * This should run more frequently than the main caching job
	 */
	async cacheActivePropIds(guildId: string): Promise<void> {
		try {
			await logger.info({
				message: 'Starting active props caching job',
				metadata: {
					source: `${this.constructor.name}.${this.cacheActivePropIds.name}`,
					guildId,
				},
			})

			const outcomeUuids =
				await this.activePropsService.refreshActiveProps(guildId)

			await logger.info({
				message: `Successfully cached ${outcomeUuids.length} active prop IDs`,
				metadata: {
					source: `${this.constructor.name}.${this.cacheActivePropIds.name}`,
					count: outcomeUuids.length,
					guildId,
				},
			})
		} catch (error) {
			await logger.error({
				message: 'Failed to cache active prop IDs',
				metadata: {
					source: `${this.constructor.name}.${this.cacheActivePropIds.name}`,
					guildId,
					error:
						error instanceof Error ? error.message : String(error),
				},
			})
			throw error
		}
	}
}
