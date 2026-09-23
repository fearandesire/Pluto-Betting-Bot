import { betFooter } from '@pluto-config'
import type { PlacedBetslip } from '@pluto-khronos/api-client'
import _ from 'lodash'
import {
	betCanceledEmbed,
	betCancellationEmbed,
	betConfirmedEmbed,
	betPlacedAnnouncementEmbed,
	doubleDownEmbed,
	formatMatchDate,
	parlayPlacedAnnouncementEmbed,
	pendingBetslip,
} from '../../../src/lib/discord/builders/betting.js'
import MoneyFormatter from '../../../src/utils/api/common/money-formatting/money-format.js'
import { MyBetsFormatterService } from '../../../src/utils/api/Khronos/bets/mybets-formatter.service.js'
import { MyBetsPaginationService } from '../../../src/utils/api/Khronos/bets/mybets-pagination.service.js'
import type { UserParlay } from '../../../src/utils/api/Khronos/parlays/ParlayApiWrapper.js'
import { ErrorEmbeds } from '../../../src/utils/common/errors/global.js'
import { type ClusterFixtures, FIXED } from './types.js'

// Celtics (-150) vs. Lakers, $100 stake, tip-off 7:30 PM ET the next day.
// No guild emojis offline: team strings use each path's no-emoji fallback.
const matchTime = '2026-10-05T23:30:00.000Z'
const stake = 100
const payout = 166.67
const profit = 66.67
const newBalance = 900
const betId = 48213

const amounts = () =>
	MoneyFormatter.formatAmounts({ amount: stake, payout, profit })

const day = (d: number, h = 18) =>
	new Date(Date.UTC(2026, 8, d, h)).toISOString()

let nextBetId = 48100
const bet = (
	team: string,
	amount: number,
	betresult: PlacedBetslip['betresult'],
	dateofbet: string,
	odds = 1.9,
): PlacedBetslip => ({
	betid: nextBetId++,
	userid: FIXED.userId,
	team,
	matchup_id: `match-${nextBetId}`,
	amount,
	payout: Math.round(amount * odds * 100) / 100,
	profit: Math.round(amount * (odds - 1) * 100) / 100,
	betresult,
	dateofbet,
	settled_at: null,
	guild_id: FIXED.guildId,
	newBalance: 0,
	dateofmatchup: dateofbet,
})

const leg = (
	selection_display: string,
	market_key: 'h2h' | 'spreads' | 'totals',
	commence_time: string,
	result: UserParlay['legs'][number]['result'],
	odds_american: number,
) => ({
	id: `leg-${selection_display}`,
	event_id: `evt-${selection_display}`,
	outcome_uuid: `out-${selection_display}`,
	market_key,
	selection_display,
	odds_american,
	point: null,
	commence_time,
	result,
	settled_at: null,
})

const pendingParlay: UserParlay = {
	id: 'a3f9c2e1-7b4d-4e0a-9c55-1d2e3f4a5b6c',
	user_id: FIXED.userId,
	guild_id: FIXED.guildId,
	stake: 25,
	combined_odds_american: 591,
	potential_payout: 172.75,
	actual_payout: null,
	status: 'pending',
	leg_count: 3,
	created_at: '2026-10-04T18:00:00.000Z',
	settled_at: null,
	legs: [
		leg('Boston Celtics', 'h2h', matchTime, 'pending', -150),
		leg(
			'Kansas City Chiefs -3.5',
			'spreads',
			'2026-10-06T17:00:00.000Z',
			'pending',
			-110,
		),
		leg(
			'Over 224.5',
			'totals',
			'2026-10-06T23:00:00.000Z',
			'pending',
			-110,
		),
	],
}

const wonParlay: UserParlay = {
	...pendingParlay,
	id: 'c81d4e2f-0a6b-4c3d-8e9f-7a6b5c4d3e2f',
	stake: 20,
	combined_odds_american: 264,
	potential_payout: 72.8,
	actual_payout: 72.8,
	status: 'won',
	leg_count: 2,
	created_at: day(28, 16),
	settled_at: day(29),
	legs: [
		leg('Denver Nuggets', 'h2h', day(28, 23), 'won', -130),
		leg('Philadelphia Eagles -6.5', 'spreads', day(29, 17), 'won', -110),
	],
}

const pendingBets = [
	bet('Boston Celtics', 100, 'pending', '2026-10-04T18:10:00.000Z', 1.6667),
	bet('Kansas City Chiefs', 50, 'pending', '2026-10-04T17:45:00.000Z', 1.8),
]

// 12 settled singles + 1 settled parlay = 13 entries → 2 history pages.
const historyBets = [
	bet('Denver Nuggets', 75, 'won', day(30, 22)),
	bet('Miami Heat', 40, 'lost', day(30, 19)),
	bet('Dallas Cowboys', 60, 'won', day(29, 20), 2.1),
	bet('Golden State Warriors', 100, 'push', day(29, 18)),
	bet('Buffalo Bills', 50, 'won', day(27, 21), 1.75),
	bet('Milwaukee Bucks', 80, 'lost', day(27, 18)),
	bet('San Francisco 49ers', 120, 'won', day(26, 20), 1.6),
	bet('Phoenix Suns', 30, 'lost', day(25, 22)),
	bet('Detroit Lions', 45, 'won', day(24, 19), 2.2),
	bet('New York Knicks', 55, 'lost', day(23, 21)),
	bet('Baltimore Ravens', 70, 'won', day(22, 18), 1.85),
	bet('Oklahoma City Thunder', 90, 'lost', day(21, 23)),
]

async function myBets(page: number) {
	const pagination = new MyBetsPaginationService({} as never, {} as never)
	const historyPage = pagination.getHistoryPage(historyBets, page, [
		wonParlay,
	])
	const { embeds, components } =
		await new MyBetsFormatterService().buildEmbedResponse({
			userId: FIXED.userId,
			pendingBets,
			pendingParlays: [pendingParlay],
			historyParlays: [wonParlay],
			historyPage,
			groupedBets: pagination.groupBetsByDate(historyPage.bets),
		})
	return { embeds, components }
}

const fixtures: ClusterFixtures = {
	cluster: 'betting',
	surfaces: [
		{
			id: 'A1',
			name: 'Pending betslip',
			before: async () =>
				pendingBetslip({
					chosenTeam: 'Boston Celtics',
					opponent: _.last('Los Angeles Lakers'.split(' '))!,
					teamLabel: _.upperFirst('Boston Celtics'),
					date: formatMatchDate(matchTime),
					amounts: await amounts(),
					avatarUrl: FIXED.avatarUrl,
				}),
		},
		{
			id: 'A2',
			name: 'Bet confirmed',
			before: async () => ({
				embeds: [
					betConfirmedEmbed({
						betOnTeam: 'Celtics',
						opponent: 'Lakers',
						chosenTeamShort: 'Celtics',
						date: formatMatchDate(matchTime),
						amounts: await amounts(),
						avatarUrl: FIXED.avatarUrl,
						betId,
						footer: betFooter({
							balance: newBalance + stake,
							betAmount: stake,
						}),
					}),
				],
				components: [],
			}),
		},
		{
			id: 'A3',
			name: 'placeBet failure (non-2xx)',
			before: async () => ({
				embeds: [
					await ErrorEmbeds.internalErr(
						'Failed to place your bet due to an unexpected response from the API. Please try again later.',
					),
				],
				components: [],
			}),
		},
		{
			id: 'A4',
			name: 'Bet cancelled (button)',
			before: () => ({
				embeds: [betCanceledEmbed(FIXED.avatarUrl)],
				components: [],
			}),
		},
		{
			id: 'A5',
			name: 'Confirm failure',
			before: async () => ({
				embeds: [
					await ErrorEmbeds.internalErr(
						'Unable to locate your bet data.',
					),
				],
				components: [],
			}),
		},
		{
			id: 'A6',
			name: 'Public "placed a bet"',
			before: () => ({
				embeds: [
					betPlacedAnnouncementEmbed({
						userId: FIXED.userId,
						betOnTeam: 'Celtics',
						formattedAmount: MoneyFormatter.toUSD(stake),
						footer: betFooter({
							balance: newBalance + stake,
							betAmount: stake,
						}),
					}),
				],
			}),
		},
		{
			id: 'A7',
			name: 'Public parlay placed',
			before: () => ({
				embeds: [
					parlayPlacedAnnouncementEmbed({
						userId: FIXED.userId,
						parlayId: pendingParlay.id,
						legCount: pendingParlay.leg_count,
						stake: pendingParlay.stake,
						potentialPayout: pendingParlay.potential_payout,
					}),
				],
			}),
		},
		{
			id: 'A8',
			name: '/cancelbet',
			before: () => ({
				embeds: [betCancellationEmbed(betId, FIXED.avatarUrl)],
			}),
		},
		{
			id: 'A9',
			name: '/doubledown',
			before: () => ({
				embeds: [
					doubleDownEmbed({
						amount: MoneyFormatter.toUSD(200),
						payout: MoneyFormatter.toUSD(333.34),
						profit: MoneyFormatter.toUSD(133.34),
						balance: MoneyFormatter.toUSD(800),
						avatarUrl: FIXED.avatarUrl,
					}),
				],
			}),
		},
		{
			id: 'A10',
			name: '/mybets',
			before: () => myBets(1),
		},
		{
			id: 'A11',
			name: 'MyBets page 2',
			before: () => myBets(2),
		},
	],
}

export default fixtures
