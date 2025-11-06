import type { MatchResponseDto } from '@kh-openapi';

export default class BetUtils {
	static calculateProfitAndPayout(
		betAmount: number,
		odds: number,
	): { profit: number; payout: number } {
		if (betAmount <= 0) {
			throw new Error('Invalid bet amount');
		}
		if (odds === 0) {
			throw new Error('Odds cannot be zero');
		}

		// Convert American odds to decimal odds
		const decimalOdds = odds > 0 ? odds / 100 + 1 : 100 / Math.abs(odds) + 1;

		// Calculate profit and total payout with decimal precision
		const profit = +((decimalOdds - 1) * betAmount).toFixed(2);
		const payout = +(betAmount + profit).toFixed(2);
		return { profit, payout };
	}

	static async getOddsForTeam(
		team: string,
		match: MatchResponseDto,
	): Promise<{ selectedTeam: string; selectedOdds: number }> {
		const { home_team, away_team, odds } = match;
		const homeOdds = odds?.home_price;
		const awayOdds = odds?.away_price;
		
		return team === home_team
			? { selectedTeam: home_team ?? '', selectedOdds: Number(homeOdds) }
			: { selectedTeam: away_team ?? '', selectedOdds: Number(awayOdds) };
	}

	static async identifyOpponent(match: MatchResponseDto, selectedTeam: string) {
		if (match.home_team === selectedTeam) {
			return match.away_team;
		}
		return match.home_team;
	}
}
