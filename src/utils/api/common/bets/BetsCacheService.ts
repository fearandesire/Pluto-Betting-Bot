import type { BetslipWithAggregationDTO, PlaceBetDto } from '@kh-openapi';
import type { CacheManager } from '../../../cache/RedisCacheManager.js';

export class BetsCacheService {
	private cachePrefix = 'bets:';

	constructor(private cache: CacheManager) {}

	async cacheUserBet(userId: string, betData: BetslipWithAggregationDTO) {
		const cacheKey = this.cachePrefix + userId;
		await this.cache.set(cacheKey, betData, 86400); // Cache for 1 day, adjust TTL as needed
	}

	async getUserBet(userId: string): Promise<BetslipWithAggregationDTO | null> {
		const cacheKey = this.cachePrefix + userId;
		const betData = await this.cache.get(cacheKey);
		return betData || null;
	}

	/**
	 * Sanitize the bet for Khronos expectations
	 * TODO: Validate on Khronos end instead
	 */
	async sanitize(betData: any): Promise<PlaceBetDto> {
		const { match, dateofmatchup, opponent, profit, payout, ...sanitizedData } =
			betData;
		return {
			...sanitizedData,
			matchup_id: match.id,
		};
	}

	async clearUserBet(userId: string) {
		const cacheKey = this.cachePrefix + userId;
		await this.cache.remove(cacheKey);
	}
}
