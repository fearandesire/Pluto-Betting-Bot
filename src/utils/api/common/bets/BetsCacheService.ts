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
	private cachePrefix = 'bets:'
	private readonly BET_CACHE_TTL = 900 // 15 minutes - matches Discord Interaction Token validity

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

		// Store simplified structure with only essential data
		const cachedData: CachedBetData = {
			userid: betData.userid,
			team: betData.team,
			amount: betData.amount,
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
	 * Prepare bet data for Khronos API finalization
	 * Now simply returns the cached data as PlaceBetDto since we store it in the right format
	 */
	async sanitize(betData: CachedBetData): Promise<PlaceBetDto> {
		return {
			userid: betData.userid,
			team: betData.team,
			amount: betData.amount,
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
