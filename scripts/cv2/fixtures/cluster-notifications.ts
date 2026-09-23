import {
	betResultEmbed,
	bigWinParlayEmbed,
	parlayResultEmbeds,
} from '../../../src/lib/discord/builders/notifications.js'
import MoneyFormatter from '../../../src/utils/api/common/money-formatting/money-format.js'
import type { ParlayResultNotification } from '../../../src/utils/api/routes/shared-payload-schemas.js'
import { buildWeeklyRecapEmbeds } from '../../../src/utils/embeds/weekly-recap.embed.js'
import { type ClusterFixtures, FIXED } from './types.js'

const parlayId = '5f3c9a1e-8b2d-4c6f-9e1a-7d4b2c8f0a13'

const leg = (
	selection_display: string,
	odds_american: number,
	result: ParlayResultNotification['legs'][number]['result'],
	i: number,
): ParlayResultNotification['legs'][number] => ({
	id: `leg-${i}`,
	event_id: `evt-${i}`,
	outcome_uuid: `outcome-${i}`,
	selection_display,
	market_key: 'h2h',
	odds_american,
	point: null,
	commence_time: new Date('2026-10-04T17:00:00Z'),
	result,
})

// Five-leg NFL Sunday parlay, $50 stake. Five legs fit in one embed; only
// parlays past ~20 fields / 4500 chars of legs split into more embeds.
const parlay: ParlayResultNotification = {
	kind: 'won',
	parlay_id: parlayId,
	user_id: FIXED.userId,
	guild_id: FIXED.guildId,
	stake: 50,
	combined_odds_american: 1245,
	payout: 672.5,
	actual_payout: 672.5,
	old_balance: 1250,
	new_balance: 1922.5,
	legs: [
		leg('Kansas City Chiefs ML', -135, 'won', 0),
		leg('Philadelphia Eagles ML', -140, 'won', 1),
		leg('San Francisco 49ers ML', -180, 'won', 2),
		leg('Detroit Lions ML', -125, 'won', 3),
		leg('Baltimore Ravens ML', -210, 'won', 4),
	],
}

const fixtures: ClusterFixtures = {
	cluster: 'notifications',
	surfaces: [
		{
			id: 'E1',
			name: 'Bet result DM (won)',
			before: async () => {
				const amounts = await MoneyFormatter.formatAmounts({
					amount: 100,
					payout: 174.07,
					profit: 74.07,
				})
				const embed = betResultEmbed({
					userId: FIXED.userId,
					betId: 48213,
					guildId: FIXED.guildId,
					result: {
						outcome: 'won',
						team: 'Kansas City Chiefs',
						betAmount: 100,
						payout: 174.07,
						profit: 74.07,
						oldBalance: 900,
						newBalance: 1074.07,
					},
					displayResult: {
						outcome: 'won',
						team: 'Kansas City Chiefs',
						betAmount: 100,
						payout: 174.07,
						profit: 74.07,
						displayBetAmount: amounts.betAmount,
						displayPayout: amounts.payout,
						displayProfit: amounts.profit,
						displayOldBalance: MoneyFormatter.toUSD(900),
						displayNewBalance: MoneyFormatter.toUSD(1074.07),
					},
				})
				return { embeds: [embed] }
			},
		},
		{
			id: 'E2',
			name: 'Parlay result DM (won)',
			// Production sends one DM per embed; all embeds shown in one message.
			before: () => ({ embeds: parlayResultEmbeds(parlay) }),
		},
		{
			id: 'E3',
			name: 'Big-win announcement (parlay)',
			before: () => ({
				embeds: [
					bigWinParlayEmbed({
						parlayId,
						guildId: FIXED.guildId,
						userId: FIXED.userId,
						payout: 672.5,
						stake: 50,
						combinedOddsAmerican: 1245,
						legs: 5,
					}),
				],
			}),
		},
		{
			id: 'E4',
			name: 'Weekly recap',
			before: () => ({
				embeds: buildWeeklyRecapEmbeds({
					window: {
						start_date: '2026-09-29T00:00:00Z',
						end_date: '2026-10-05T23:59:59Z',
						week_number: 5,
						season_year: 2026,
					},
					total_predictions: 412,
					correct_predictions: 238,
					incorrect_predictions: 174,
					accuracy: 57.77,
					accuracy_delta: 3.4,
					top_predictors: [
						{
							user_id: FIXED.userId,
							display_name: FIXED.username,
							correct_predictions: 21,
							incorrect_predictions: 6,
							success_rate: 77.78,
						},
						{
							user_id: '100000000000000011',
							display_name: 'hoopsgod',
							correct_predictions: 19,
							incorrect_predictions: 7,
							success_rate: 73.08,
						},
						{
							user_id: '100000000000000012',
							display_name: 'gridiron_gary',
							correct_predictions: 17,
							incorrect_predictions: 8,
							success_rate: 68,
						},
						{
							user_id: '100000000000000013',
							display_name: 'lockoftheweek',
							correct_predictions: 15,
							incorrect_predictions: 9,
							success_rate: 62.5,
						},
						{
							user_id: '100000000000000014',
							display_name: 'fadeTheBooks',
							correct_predictions: 14,
							incorrect_predictions: 10,
							success_rate: 58.33,
						},
					],
					biggest_single_win: {
						user_id: '100000000000000011',
						payout: 845,
						bet_id: 48190,
					},
					biggest_parlay_win: {
						user_id: FIXED.userId,
						payout: 672.5,
						parlay_id: parlayId,
					},
				}),
			}),
		},
	],
}

export default fixtures
