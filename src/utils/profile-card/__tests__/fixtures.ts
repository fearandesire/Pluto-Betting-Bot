import type { ProfileCardData } from '../profile-card.js'

export const fullCard: ProfileCardData = {
	displayName: 'FenixPlays',
	tier: 'Gold',
	level: 38,
	summary: {
		settled_bets: 31,
		wins: 18,
		losses: 11,
		pushes: 2,
		net_profit: 1342.5,
		best_win_payout: 612.75,
		settled_predictions: 40,
		prediction_hit_rate: 0.625,
	},
	badges: [
		{ key: 'parlay_pro', name: 'Parlay Pro' },
		{ key: 'sharp_eye', name: 'Sharp Eye' },
		{ key: 'in_the_black', name: 'In the Black' },
		{ key: 'ten_wins', name: 'Ten Wins' },
		{ key: 'first_win', name: 'First Win' },
	],
	earnedCount: 5,
}

export const emptyCard: ProfileCardData = {
	displayName: 'NewPlayer',
	tier: 'Bronze',
	level: 0,
	summary: {
		settled_bets: 0,
		wins: 0,
		losses: 0,
		pushes: 0,
		net_profit: 0,
		best_win_payout: null,
		settled_predictions: 0,
		prediction_hit_rate: null,
	},
	badges: [],
}

export const stressCard: ProfileCardData = {
	displayName: 'A Very Long Display Name <script>& Friends The Third',
	tier: 'Diamond',
	level: 100,
	summary: {
		settled_bets: 999,
		wins: 540,
		losses: 430,
		pushes: 29,
		net_profit: -123456.78,
		best_win_payout: 98765.43,
		settled_predictions: 300,
		prediction_hit_rate: 0.5133,
	},
	badges: [
		{
			key: 'unknown',
			name: 'An Extremely Long Achievement Name That Keeps Going',
		},
		{ key: 'fifty_wins', name: 'Fifty Wins' },
		{ key: 'courtside', name: 'Courtside' },
		{ key: 'prop_hunter', name: 'Prop Hunter' },
		{ key: 'constructor', name: 'Unknown Award' },
	],
	earnedCount: 12,
}
