import type {
	BetslipWithAggregationDTO,
	PlaceBetDto,
	PlaceBetDtoMarketKeyEnum,
} from '@kh-openapi'
import type { CacheManager } from '../../../cache/cache-manager.js'

/**
 * Simplified bet data structure for caching
 * Stores only essential data needed for bet finalization
 */
export interface CachedBetData {
	userid: string
	team: string
	amount: number
	/**
	 * Canonical match identifier — same value as the upstream provider's event ID.
	 */
	event_id: string
	/**
	 * Legacy alias for `event_id`. Kept populated for backward compatibility with
	 * older Khronos endpoints that still accept the deprecated `matchup_id` field.
	 * TODO: Remove once Pluto fully migrates off `matchup_id` (target: 2026-Q3).
	 */
	matchup_id: string
	opponent: string
	dateofmatchup: string
	profit: number
	payout: number
	guild_id: string
	market_key: PlaceBetDtoMarketKeyEnum
	betresult: string
	dateofbet: string
}

export class BetsCacheService {
	private readonly cachePrefix = 'bets:'
	private readonly BET_CACHE_TTL = 900 // 15 minutes - allows users time to finalize bets within session lifecycle

	constructor(private cache: CacheManager) {}

	/**
	 * Cache a pending bet with simplified structure
	 * Extracts match ID from the match object to avoid storing redundant data
	 */
	async cacheUserBet(
		userId: string,
		betData: BetslipWithAggregationDTO & { guild_id: string },
	) {
		const cacheKey = this.cachePrefix + userId

		// Extract match ID from the properly typed match object
		const matchId = betData.match.id
		if (!matchId) {
			throw new Error('Match ID not found in betslip data')
		}

		// Store simplified structure with only essential data.
		// `event_id` is the canonical match identifier; `matchup_id` is the legacy
		// alias kept populated for backward compatibility with older Khronos endpoints.
		const cachedData: CachedBetData = {
			userid: betData.userid,
			team: betData.team,
			amount: betData.amount,
			event_id: matchId,
			matchup_id: matchId,
			opponent: betData.opponent,
			dateofmatchup: betData.dateofmatchup,
			profit: betData.profit ?? 0,
			payout: betData.payout ?? 0,
			guild_id: betData.guild_id,
			market_key: ((betData as any).market_key ??
				'h2h') as PlaceBetDtoMarketKeyEnum,
			betresult: (betData as any).betresult ?? 'pending',
			dateofbet: (betData as any).dateofbet ?? new Date().toISOString(),
		}

		await this.cache.set(cacheKey, cachedData, this.BET_CACHE_TTL)
	}

	/**
	 * Retrieve cached bet data
	 */
	async getUserBet(userId: string): Promise<CachedBetData | null> {
		const cacheKey = this.cachePrefix + userId
		const betData = await this.cache.get(cacheKey)
		return betData || null
	}

	/**
	 * Update cached bet data with new values (e.g., profit/payout after match selection)
	 */
	async updateUserBet(
		userId: string,
		updates: Partial<CachedBetData>,
	): Promise<void> {
		const cacheKey = this.cachePrefix + userId
		const existingBet = await this.getUserBet(userId)

		if (!existingBet) {
			throw new Error('No cached bet found to update')
		}

		const updatedBet: CachedBetData = {
			...existingBet,
			...updates,
		}

		await this.cache.set(cacheKey, updatedBet, this.BET_CACHE_TTL)
	}

	/**
	 * Prepare bet data for Khronos API finalization.
	 * Sends `event_id` as the canonical match identifier and keeps `matchup_id`
	 * populated alongside it for backward compatibility during the deprecation window.
	 */
	async sanitize(betData: CachedBetData): Promise<PlaceBetDto> {
		return {
			userid: betData.userid,
			team: betData.team,
			amount: betData.amount,
			event_id: betData.event_id,
			matchup_id: betData.matchup_id,
			guild_id: betData.guild_id,
			market_key: betData.market_key,
		}
	}

	async clearUserBet(userId: string) {
		const cacheKey = this.cachePrefix + userId
		await this.cache.remove(cacheKey)
	}
}
