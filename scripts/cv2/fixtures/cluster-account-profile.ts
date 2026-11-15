import { buildBadgeEmojiRegistry } from '../../../src/lib/badges/badge-emoji-registry.js'
import { BADGE_PRESENTATION } from '../../../src/lib/badges/badge-presentation.js'
import { buildAchievementsView } from '../../../src/lib/badges/badge-view.js'
import {
	type ProfileViewModel,
	profileSettingsPayload,
	profileViewPayload,
} from '../../../src/lib/discord/builders/profile-views.js'
import type { ProfileView } from '../../../src/lib/profile/profile-view.js'
import type { UserAchievementsDto } from '../../../src/utils/api/Khronos/achievements/achievements-wrapper.js'
import { type ClusterFixtures, FIXED } from './types.js'

// Fictional players. The emoji ids are fictional too; the art is mapped to
// local files in IMAGE_CACHE.
const KEYS = Object.keys(BADGE_PRESENTATION)
const EMOJI = buildBadgeEmojiRegistry(
	Object.values(BADGE_PRESENTATION).map((badge, i) => ({
		name: badge.emojiName,
		id: String(900000000000000001n + BigInt(i)),
	})),
)

/** Newest first, matching what Khronos returns. */
const EARNED_ORDER = [
	'trust_the_process',
	'prop_hunter',
	'fifty_wins',
	'courtside',
	'in_the_black',
	'parlay_pro',
	'ten_wins',
	'due_a_win',
	'first_win',
]
const AWARDED = [
	'2026-11-09',
	'2026-10-30',
	'2026-10-21',
	'2026-10-02',
	'2026-08-14',
	'2026-06-27',
	'2026-05-11',
	'2026-04-03',
	'2026-03-29',
]

const dtoFor = (earnedKeys: string[]): UserAchievementsDto => ({
	user_id: FIXED.userId,
	earned: earnedKeys.map((key) => ({
		key,
		name: key,
		description: '',
		awarded_at: `${AWARDED[EARNED_ORDER.indexOf(key)]}T12:00:00.000Z`,
	})),
	locked: KEYS.filter((key) => !earnedKeys.includes(key)).map((key) => ({
		key,
		name: key,
		description: '',
		progress: 0,
		target: 1,
	})),
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
})

const player = (
	displayName: string,
	earnedKeys: string[],
	stats: ProfileViewModel['stats'],
	money: { balance: number; level: number; tier: string },
): ProfileViewModel => ({
	userId: FIXED.userId,
	displayName,
	avatarUrl: FIXED.avatarUrl,
	...money,
	stats,
	achievements: buildAchievementsView(dtoFor(earnedKeys), EMOJI),
})

const none = player(
	'Jordan',
	[],
	{ wins: 0, losses: 2, pushes: 0, netProfit: -75 },
	{ balance: 925, level: 1, tier: 'Bronze' },
)
const few = player(
	'Maya',
	['in_the_black', 'ten_wins'],
	{ wins: 18, losses: 14, pushes: 1, netProfit: 412.75 },
	{ balance: 3215, level: 9, tier: 'Silver' },
)
const many = player(
	'Carl',
	EARNED_ORDER,
	{ wins: 64, losses: 41, pushes: 3, netProfit: 2318.4 },
	{ balance: 12480.5, level: 23, tier: 'Gold' },
)

const withoutFiles = <T extends { files?: unknown }>({
	files,
	...message
}: T): Omit<T, 'files'> => message

const route = { ownerId: FIXED.userId }
const card = (
	view: ProfileView,
	model: ProfileViewModel,
	extra: { expanded?: boolean; page?: number } = {},
) => withoutFiles(profileViewPayload({ view, model, route, ...extra }))

const fixtures: ClusterFixtures = {
	cluster: 'account',
	surfaces: [
		{
			id: 'D11a',
			name: '/profile Headline, no achievements',
			after: () => card('headline', none),
		},
		{
			id: 'D11b',
			name: '/profile Headline, a few achievements',
			after: () => card('headline', few),
		},
		{
			id: 'D11c',
			name: '/profile Headline, many achievements collapsed',
			after: () => card('headline', many),
		},
		{
			id: 'D11d',
			name: '/profile Headline, many achievements expanded',
			after: () => card('headline', many, { expanded: true }),
		},
		{
			id: 'D12a',
			name: '/profile Trophy Shelf, no achievements',
			after: () => card('trophy_shelf', none),
		},
		{
			id: 'D12b',
			name: '/profile Trophy Shelf, a few achievements',
			after: () => card('trophy_shelf', few),
		},
		{
			id: 'D12c',
			name: '/profile Trophy Shelf, many achievements collapsed',
			after: () => card('trophy_shelf', many),
		},
		{
			id: 'D12d',
			name: '/profile Trophy Shelf, many achievements expanded (page 1)',
			after: () =>
				card('trophy_shelf', many, { expanded: true, page: 0 }),
		},
		{
			id: 'D12e',
			name: '/profile Trophy Shelf, many achievements expanded (page 2)',
			after: () =>
				card('trophy_shelf', many, { expanded: true, page: 1 }),
		},
		{
			id: 'D13',
			name: '/profile settings, default view',
			after: () =>
				withoutFiles(
					profileSettingsPayload({
						ownerId: FIXED.userId,
						current: 'trophy_shelf',
					}),
				),
		},
	],
}

export default fixtures
