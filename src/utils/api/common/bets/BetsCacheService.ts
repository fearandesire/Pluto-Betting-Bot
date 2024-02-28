import { CacheManager } from '@pluto-redis'
import { BetslipWithAggregationDTO, PlaceBetDto } from '@khronos-index'

export class BetsCacheService {
	private cachePrefix = 'bets:'

	constructor(private cache: CacheManager) {}

	async cacheUserBet(userId: string, betData: BetslipWithAggregationDTO) {
		const cacheKey = this.cachePrefix + userId
		await this.cache.set(cacheKey, betData, 86400) // Cache for 1 day, adjust TTL as needed
		console.log(`Cached bet for user ${userId}\nKey: ${cacheKey}`)
	}

	async getUserBet(
		userId: string,
	): Promise<BetslipWithAggregationDTO | null> {
		const cacheKey = this.cachePrefix + userId
		const betData = await this.cache.get(cacheKey)
		return betData || null
	}

	async sanitize(betData: any): Promise<PlaceBetDto> {
		console.debug({
			method: this.sanitize.name,
			status: `Pre-parsed`,
			data: {
				betData,
			},
		})
		// Organize props to fit expected structure for Khronos
		betData.matchup_id = betData.match.id
		// Remove unnecessary data so the bet can be placed
		delete betData?.match
		delete betData?.dateofmatchup
		delete betData?.opponent
		delete betData?.profit
		delete betData?.payout
		console.debug({
			method: this.sanitize.name,
			status: `Sanitized`,
			data: {
				betData,
			},
		})
		return betData
	}

	async clearUserBet(userId: string) {
		const cacheKey = this.cachePrefix + userId
		await this.cache.remove(cacheKey)
		console.log(`Cleared cached bet for user ${userId}`)
	}
}
