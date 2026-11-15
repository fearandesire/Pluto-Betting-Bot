import { buildBadgeEmojiRegistry } from '../../../src/lib/badges/badge-emoji-registry.js'
import { BADGE_PRESENTATION } from '../../../src/lib/badges/badge-presentation.js'
import { buildAchievementsView } from '../../../src/lib/badges/badge-view.js'
import {
	accountCreatedEmbed,
	h2hStatsEmbed,
	type LeaderboardEntry,
	leaderboardPageEmbed,
	profileDescription,
	successEmbed,
	welcomeEmbed,
} from '../../../src/lib/discord/builders/account.js'
import {
	achievementsPayload,
	profileBadgeLine,
} from '../../../src/lib/discord/builders/achievements.js'
import { profileCardPayload } from '../../../src/lib/discord/builders/profile.js'
import { FALLBACK_FOOTERS } from '../../../src/lib/footers/fallbackFooters.js'
import { plutoWelcomeMsg } from '../../../src/utils/api/common/interfaces/kh-pluto/kh-pluto.interface.js'
import type { UserAchievementsDto } from '../../../src/utils/api/Khronos/achievements/achievements-wrapper.js'
import { fullCard } from '../../../src/utils/profile-card/__tests__/fixtures.js'
import {
	MAX_PROFILE_BADGES,
	renderProfileCard,
} from '../../../src/utils/profile-card/profile-card.js'
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

// Fictional player. The emoji ids are fictional too, so a render shows the
// <:name:id> token the way Discord does for an emoji the viewer cannot see.
const EMOJI_IDS = buildBadgeEmojiRegistry(
	Object.values(BADGE_PRESENTATION).map((badge, i) => ({
		name: badge.emojiName,
		id: String(900000000000000001n + BigInt(i)),
	})),
)
const NO_EMOJI = buildBadgeEmojiRegistry([])

const withoutFiles = <T extends { files?: unknown }>({
	files,
	...message
}: T): Omit<T, 'files'> => message

const earned = (key: string) => ({
	key,
	name: key,
	description: '',
	awarded_at: '2026-10-01T12:00:00.000Z',
})
const count = (
	metric: string,
	label: string,
	current: number,
	target: number,
) => ({
	metric,
	label,
	unit: 'count',
	comparator: 'gte',
	target,
	current,
	met: current >= target,
})
const achievementsFixture: UserAchievementsDto = {
	user_id: FIXED.userId,
	earned: ['first_win', 'ten_wins', 'in_the_black', 'due_a_win'].map(earned),
	locked: [
		{
			key: 'fifty_wins',
			name: 'Club Fifty',
			description: 'Win 50 head-to-head bets.',
			progress: 37,
			target: 50,
		},
		{
			key: 'sharp_eye',
			name: 'The Line Reader',
			description:
				'Keep a hit rate of 60% or better across at least 20 settled predictions.',
			progress: 19,
			target: 20,
			kind: 'form',
			gates: [
				count('settled_predictions', 'Settled predictions', 20, 20),
				{
					metric: 'prediction_hit_rate',
					label: 'Prediction hit rate',
					unit: 'ratio',
					comparator: 'gte',
					target: 0.6,
					current: 0.55,
					met: false,
				},
			],
		},
		{
			key: 'prop_hunter',
			name: 'Player’s Edge',
			description: 'Get 10 player prop predictions right.',
			progress: 6,
			target: 10,
		},
		{
			key: 'parlay_pro',
			name: 'All Legs Home',
			description: 'Win a parlay.',
			progress: 0,
			target: 1,
		},
		{
			key: 'courtside',
			name: 'Courtside',
			description: 'Get 10 NBA predictions right.',
			progress: 3,
			target: 10,
		},
		{
			key: 'trust_the_process',
			name: 'Trust the Process',
			description:
				'Have 50 bets, predictions or parlays settle across at least 20 different games.',
			progress: 41,
			target: 50,
			kind: 'career',
			gates: [
				count('settled_choices', 'Settled choices', 41, 50),
				count('distinct_events', 'Different games', 17, 20),
			],
		},
	],
	summary: {
		settled_bets: 31,
		wins: 18,
		losses: 11,
		pushes: 2,
		net_profit: 1342.5,
		best_win_payout: 612.75,
		settled_predictions: 40,
		prediction_hit_rate: 0.55,
	},
}

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
		{
			id: 'D8',
			name: '/achievements',
			after: () =>
				withoutFiles(
					achievementsPayload(
						buildAchievementsView(achievementsFixture, EMOJI_IDS),
						FIXED.username,
					),
				),
		},
		{
			id: 'D9',
			name: '/achievements (no application emoji)',
			after: () =>
				withoutFiles(
					achievementsPayload(
						buildAchievementsView(achievementsFixture, NO_EMOJI),
						FIXED.username,
					),
				),
		},
		{
			id: 'D10',
			name: '/profile (badge line, Achievements button)',
			after: async () => {
				const png = await renderProfileCard(fullCard)
				const view = buildAchievementsView(
					achievementsFixture,
					EMOJI_IDS,
				)
				const { files, ...message } = profileCardPayload({
					png,
					route: { ownerId: FIXED.userId, targetId: FIXED.userId },
					badgeLine: profileBadgeLine(view, MAX_PROFILE_BADGES),
				})
				return {
					...message,
					files: [
						{
							name: 'profile-card.png',
							url: `data:image/png;base64,${png.toString('base64')}`,
						},
					],
				}
			},
		},
	],
}

export default fixtures
