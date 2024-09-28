import { CacheManager } from "../../../cache/RedisCacheManager.js";
import { BetslipWithAggregationDTO, PlaceBetDto } from "@kh-openapi";

export class BetsCacheService {
	private cachePrefix = "bets:";

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

	async sanitize(betData: any): Promise<PlaceBetDto> {
		// Organize props to fit the expected structure for Khronos
		betData.matchup_id = betData.match.id;
		// Remove unnecessary data so the bet can be placed
		delete betData?.match;
		delete betData?.dateofmatchup;
		delete betData?.opponent;
		delete betData?.profit;
		delete betData?.payout;
		return betData;
	}

	async clearUserBet(userId: string) {
		const cacheKey = this.cachePrefix + userId;
		await this.cache.remove(cacheKey);
	}
}
