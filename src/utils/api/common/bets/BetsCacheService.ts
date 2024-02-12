import { CacheManager } from '@pluto-redis'
import { IFinalizedBetslip } from '../../../../lib/interfaces/api/bets/betslips.interfaces' // Assuming a generic CacheManager interface

export class BetsCacheService {
	private cachePrefix = 'bets:'

	constructor(private cache: CacheManager) {}

	async cacheUserBet(userId: string, betData: any) {
		const cacheKey = this.cachePrefix + userId
		await this.cache.set(cacheKey, betData, 86400) // Cache for 1 day, adjust TTL as needed
		console.log(`Cached bet for user ${userId}`)
	}

	async getUserBet(userId: string): Promise<IFinalizedBetslip | null> {
		const cacheKey = this.cachePrefix + userId
		const betData = await this.cache.get(cacheKey)
		return betData || null
	}

	async clearUserBet(userId: string) {
		const cacheKey = this.cachePrefix + userId
		await this.cache.remove(cacheKey)
		console.log(`Cleared cached bet for user ${userId}`)
	}
}
