import {
	type AllUserPredictionsDto,
	GetAllPredictionsFilteredStatusEnum,
	type ProcessedPropDto,
} from '@pluto-khronos/api-client'
import type { User } from 'discord.js'
import { teamResolver } from 'resolve-team'
import {
	type LeaderboardRow,
	leaderboardScore,
	predictionDeprecationEmbed,
	predictionHistoryField,
	predictionHistoryPaginator,
	predictionHistoryTemplate,
	predictionLeaderboardEmbed,
	predictionStatsEmbed,
	propPostButtons,
	propPostEmbed,
	propSettlementEmbed,
	resolveStreakBadgeTier,
} from '../../../src/lib/discord/builders/props.js'
import { DateManager } from '../../../src/utils/common/DateManager.js'
import Pagination from '../../../src/utils/embeds/pagination.js'
import { type ClusterFixtures, FIXED } from './types.js'

// Bills @ Chiefs, Sun 2026-10-04 20:25Z. No guild emojis offline, so match
// labels use TeamInfo's short-name fallback.
const prop: ProcessedPropDto = {
	event_id: 'evt-bills-chiefs',
	commence_time: '2026-10-04T20:25:00Z',
	home_team: 'Kansas City Chiefs',
	away_team: 'Buffalo Bills',
	sport_title: 'NFL',
	market_key: 'player_pass_yds',
	bookmaker_key: 'draftkings',
	description: 'Patrick Mahomes',
	point: 274.5,
	over: {
		outcome_uuid: '7d0c7a52-1f0e-4a8e-9c35-2b6f0f1a0001',
		outcome_name: 'Over',
		price: -115,
	},
	under: {
		outcome_uuid: '7d0c7a52-1f0e-4a8e-9c35-2b6f0f1a0002',
		outcome_name: 'Under',
		price: -105,
	},
}

/** Mirrors TeamInfo.getTeamInfo without the client emoji cache. */
async function propTeams() {
	const [home, away] = await Promise.all([
		teamResolver.resolve(prop.home_team, { full: true }),
		teamResolver.resolve(prop.away_team, { full: true }),
	])
	return {
		homeAbbrev: home.abbrev,
		awayAbbrev: away.abbrev,
		homeColor: Number.parseInt((home.colors[0] ?? '#0099ff').slice(1), 16),
	}
}

const propPost = async () => propPostEmbed(prop, 'nfl', await propTeams())

// C5: 12 predictions → two pages of 10, so Sapphire shows its nav row.
const players: [string, string, string, number, 'over' | 'under'][] = [
	[
		'Buffalo Bills vs. Kansas City Chiefs',
		'Patrick Mahomes',
		'player_pass_yds',
		274.5,
		'over',
	],
	[
		'Buffalo Bills vs. Kansas City Chiefs',
		'Josh Allen',
		'player_pass_tds',
		1.5,
		'over',
	],
	[
		'Buffalo Bills vs. Kansas City Chiefs',
		'Travis Kelce',
		'player_reception_yds',
		58.5,
		'under',
	],
	[
		'Philadelphia Eagles vs. Dallas Cowboys',
		'Saquon Barkley',
		'player_rush_yds',
		89.5,
		'over',
	],
	[
		'Philadelphia Eagles vs. Dallas Cowboys',
		'Dak Prescott',
		'player_pass_yds',
		251.5,
		'under',
	],
	[
		'Philadelphia Eagles vs. Dallas Cowboys',
		'CeeDee Lamb',
		'player_reception_yds',
		79.5,
		'over',
	],
	[
		'Los Angeles Rams vs. San Francisco 49ers',
		'Christian McCaffrey',
		'player_rush_yds',
		84.5,
		'over',
	],
	[
		'Los Angeles Rams vs. San Francisco 49ers',
		'Matthew Stafford',
		'player_pass_tds',
		1.5,
		'under',
	],
	[
		'Los Angeles Rams vs. San Francisco 49ers',
		'Puka Nacua',
		'player_reception_yds',
		71.5,
		'over',
	],
	[
		'Detroit Lions vs. Green Bay Packers',
		'Jared Goff',
		'player_pass_yds',
		262.5,
		'over',
	],
	[
		'Detroit Lions vs. Green Bay Packers',
		'Jahmyr Gibbs',
		'player_rush_yds',
		74.5,
		'under',
	],
	[
		'Detroit Lions vs. Green Bay Packers',
		'Jordan Love',
		'player_pass_tds',
		1.5,
		'over',
	],
]
const results = [
	null,
	null,
	null,
	true,
	false,
	true,
	true,
	false,
	true,
	true,
	false,
	true,
]
const commence = [
	'2026-10-04T20:25:00Z',
	'2026-10-04T20:25:00Z',
	'2026-10-04T20:25:00Z',
	'2026-09-28T20:25:00Z',
	'2026-09-28T20:25:00Z',
	'2026-09-28T20:25:00Z',
	'2026-09-27T00:20:00Z',
	'2026-09-27T00:20:00Z',
	'2026-09-27T00:20:00Z',
	'2026-09-21T17:00:00Z',
	'2026-09-21T17:00:00Z',
	'2026-09-21T17:00:00Z',
]

/** Mirrors predictions.ts parseMatchString with no emojis: short names. */
const shortMatch = (matchString: string) =>
	matchString
		.split(' vs. ')
		.map((team) => team.split(' ').pop())
		.join(' vs. ')

function historyFields() {
	const dates = new DateManager()
	return players.map(
		([match_string, description, market_key, point, choice], i) => {
			const isCorrect = results[i]
			const prediction = {
				id: `pred-${i}`,
				user_id: FIXED.userId,
				outcome_uuid: `outcome-${i}`,
				event_id: `evt-${i}`,
				sport: 'nfl',
				choice,
				is_correct: isCorrect,
				status:
					isCorrect === null
						? GetAllPredictionsFilteredStatusEnum.Pending
						: GetAllPredictionsFilteredStatusEnum.Completed,
				guild_id: FIXED.guildId,
				market_key,
				bookmaker_key: 'draftkings',
				match_string,
				description,
			} as unknown as AllUserPredictionsDto
			return predictionHistoryField({
				prediction,
				matchLabel: shortMatch(match_string),
				date: dates.toMMDDYYYY(commence[i]),
				point,
				marketKey: market_key,
			})
		},
	)
}

// C7: 24 members → two pages of 20.
const names = [
	'Pluto Tester',
	'hoopsgod',
	'gridiron_gary',
	'lockoftheweek',
	'fadeTheBooks',
	'mia_parlays',
	'sharpshooter',
	'underdog_ally',
	'bankrollbenny',
	'overunderoscar',
	'chalkeater',
	'teaser_tina',
	'moneyline_mo',
	'spreadsheet',
	'the_closer',
	'sundayscaries',
	'badbeatbob',
	'coverqueen',
	'juicefree',
	'longshot_lou',
	'pushmaster',
	'hedgehog',
	'vig_vicky',
	'twopointtom',
]
function leaderboardRows(): LeaderboardRow[] {
	return names.map((username, i) => {
		const correct = 38 - i
		const incorrect = 9 + (i % 5)
		const currentStreak = [11, 6, 0, 3, 4, 1][i] ?? i % 3
		return {
			position: i + 1,
			username,
			score: leaderboardScore(correct, incorrect),
			correctPredictions: correct,
			incorrectPredictions: incorrect,
			currentStreak,
			badgeTier: null,
		}
	})
}

const fixtures: ClusterFixtures = {
	cluster: 'props',
	surfaces: [
		{
			id: 'C1',
			name: 'Prop post',
			before: async () => ({
				embeds: [await propPost()],
				components: [propPostButtons(prop)],
			}),
		},
		{
			id: 'C2',
			name: 'Prop settlement edit',
			before: async () => ({
				embeds: [
					propSettlementEmbed((await propPost()).toJSON(), {
						outcome_uuid: prop.over.outcome_uuid,
						result: 'won',
						winning_side_display: 'Over',
						actual_value: 301,
						market_key: prop.market_key,
						description: prop.description,
						point: prop.point,
						tallies: { correct: 14, incorrect: 9, total: 23 },
						messages: [
							{
								guild_id: FIXED.guildId,
								channel_id: FIXED.channelId,
								message_id: '400000000000000004',
							},
						],
					}),
				],
				// deliverPropSettlementMessage edits with `components: []`.
				components: [],
			}),
		},
		{
			id: 'C5',
			name: '/predictions history',
			before: async () => {
				const paginator = predictionHistoryPaginator(
					predictionHistoryTemplate(FIXED.username, null),
					historyFields(),
				)
				// Page 1 exactly as Sapphire resolves it: template merge, "1 / 2"
				// footer, and its default select menu + nav buttons.
				const page = await paginator.resolvePage(
					{ channel: { guild: null } } as never,
					{ id: FIXED.userId } as User,
					0,
				)
				return {
					embeds: [...(page.embeds ?? [])],
					components: [...page.components],
				}
			},
		},
		{
			id: 'C6',
			name: '/predictions stats',
			before: () => {
				const currentStreak = 4
				return {
					embeds: [
						predictionStatsEmbed({
							username: FIXED.username,
							totalPredictions: 47,
							correctPredictions: 30,
							incorrectPredictions: 17,
							winRate: 63.829787,
							pendingCount: 3,
							currentStreak,
							bestStreak: 9,
							statsAvailable: true,
							badgeTier: resolveStreakBadgeTier(
								currentStreak,
								null,
							),
						}),
					],
				}
			},
		},
		{
			id: 'C7',
			name: '/predictions leaderboard',
			before: () => {
				const rows = leaderboardRows()
				const totalPages = Math.ceil(rows.length / 20)
				return {
					embeds: [
						predictionLeaderboardEmbed(
							rows.slice(0, 20),
							1,
							rows.length,
						),
					],
					components: new Pagination().createPaginationButtons(
						1,
						totalPages,
					),
				}
			},
		},
		{
			id: 'C8',
			name: 'Deprecated prediction alias (/history)',
			before: () => ({
				embeds: [predictionDeprecationEmbed('/predictions history')],
			}),
		},
	],
}

export default fixtures
