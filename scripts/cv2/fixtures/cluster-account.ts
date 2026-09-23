import {
	accountCreatedEmbed,
	h2hStatsEmbed,
	type LeaderboardEntry,
	leaderboardPageEmbed,
	profileDescription,
	successEmbed,
	welcomeEmbed,
} from '../../../src/lib/discord/builders/account.js'
import { FALLBACK_FOOTERS } from '../../../src/lib/footers/fallbackFooters.js'
import { plutoWelcomeMsg } from '../../../src/utils/api/common/interfaces/kh-pluto/kh-pluto.interface.js'
import { type ClusterFixtures, FIXED } from './types.js'

// helpfooter() with Math.random = 0 picks the first fallback entry.
const coreFooter = FALLBACK_FOOTERS.core[0]
const generalFooter = FALLBACK_FOOTERS.general[0]

const LB_NAMES = [
	'lakeshowlarry',
	'chiefskingdom',
	'celticsfan33',
	'Pluto Tester',
	'mahomesmagic',
	'nuggetsnation',
	'birdgang_jalen',
	'dubnation30',
	'bucksinsix',
	'knicksknation',
	'ravensflock52',
	'suns_valley',
	'billsmafia17',
	'heatculture',
]
const leaderboard: LeaderboardEntry[] = LB_NAMES.map((memberTag, i) => ({
	memberTag,
	balance: (12_450.5 - i * 815.25).toFixed(2),
}))

const fixtures: ClusterFixtures = {
	cluster: 'account',
	surfaces: [
		{
			id: 'D1',
			name: '/balance (profile)',
			before: () => ({
				embeds: [
					successEmbed({
						title: `${FIXED.username}'s Profile`,
						description: profileDescription({
							balance: '$1,284.50',
							level: 7,
							tier: 'Silver',
						}),
						footer: coreFooter,
						thumbnail: FIXED.avatarUrl,
					}),
				],
			}),
		},
		{
			id: 'D2',
			name: '/dailyclaim',
			before: () => ({
				embeds: [
					successEmbed({
						title: '💰 Processed Daily Claim',
						description: 'Your balance is **`$1,304.50`**',
						footer: coreFooter,
						thumbnail: FIXED.avatarUrl,
					}),
				],
			}),
		},
		{
			id: 'D3',
			name: '/register',
			before: () => ({
				embeds: [accountCreatedEmbed(100, FIXED.avatarUrl)],
			}),
		},
		{
			// Reaction-paged: ⬅️ ➡️ reactions are added after send and are
			// not part of the message payload, so they don't show here.
			id: 'D4',
			name: '/leaderboard (page 1, reactions not shown)',
			before: () => ({
				embeds: [
					leaderboardPageEmbed(
						leaderboard.slice(0, 10),
						1,
						Math.ceil(leaderboard.length / 10),
						10,
					),
				],
			}),
		},
		{
			id: 'D5',
			name: '/stats h2h view',
			before: () => ({
				embeds: [
					h2hStatsEmbed(
						FIXED.username,
						{
							totalBets: 48,
							totalWins: 27,
							totalLosses: 19,
							pushes: 2,
							voids: 0,
							pending: 3,
							settled_sample: 46,
							winRate: 58.7,
							total_staked: 6240,
							gross_return: 7015,
							net_profit: 775,
							roi: 12.4,
							mostBetTeam: {
								team: 'Los Angeles Lakers',
								count: 11,
							},
							mostLossesTeam: {
								team: 'Kansas City Chiefs',
								losses: 5,
							},
							highestBetAmount: 750,
							profitLossSummary: {
								totalWon: 3890,
								totalLost: 3115,
								netProfit: 775,
							},
						},
						generalFooter,
					),
				],
			}),
		},
		{
			id: 'D6',
			name: 'Welcome DM',
			before: () => ({ embeds: [welcomeEmbed(plutoWelcomeMsg)] }),
		},
	],
}

export default fixtures
