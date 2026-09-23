import type { DateGroupDto } from '@pluto-khronos/api-client'
import type { PaginatedMessageEmbedFields } from '@sapphire/discord.js-utilities'
import {
	activePropsEmbed,
	activePropsFields,
	appLogEmbed,
	fieldsPaginator,
	footerStatusEmbed,
	guildConfigViewEmbed,
	predictionDeletedEmbed,
	predictionField,
	predictionsTemplateEmbed,
	propsPostedEmbed,
} from '../../../src/lib/discord/builders/admin.js'
import { commandErrorLogEmbed } from '../../../src/lib/discord/builders/admin-command-error.js'
import { LogType } from '../../../src/utils/logging/AppLog.interface.js'
import { type ClusterFixtures, type DumpMessage, FIXED } from './types.js'

/**
 * Page 1 exactly as Sapphire sends it: the library's own page resolution,
 * footer ("1 / N • …") and default action rows (5 buttons + page select).
 */
async function firstPage(
	pm: PaginatedMessageEmbedFields,
): Promise<DumpMessage> {
	const page = await pm.resolvePage(
		{ channel: { type: 0, guild: null } } as never,
		{ id: FIXED.userId } as never,
		0,
	)
	return {
		embeds: [...(page.embeds ?? [])],
		components: [...(page.components ?? [])],
	}
}

const ago = (min: number) => new Date(FIXED.now.getTime() - min * 60_000)

const PREDICTIONS = [
	[
		'a1b2c3d4-0000-4000-8000-00000000e1f1',
		'over',
		27.5,
		'player_points',
		'LeBron James',
		'Lakers vs. Celtics',
	],
	[
		'a1b2c3d4-0000-4000-8000-00000000e1f2',
		'under',
		8.5,
		'player_assists',
		'Jayson Tatum',
		'Lakers vs. Celtics',
	],
	[
		'a1b2c3d4-0000-4000-8000-00000000e1f3',
		'over',
		11.5,
		'player_rebounds',
		'Nikola Jokic',
		'Nuggets vs. Warriors',
	],
	[
		'a1b2c3d4-0000-4000-8000-00000000e1f4',
		'over',
		3.5,
		'player_threes',
		'Stephen Curry',
		'Nuggets vs. Warriors',
	],
	[
		'a1b2c3d4-0000-4000-8000-00000000e1f5',
		'under',
		30.5,
		'player_points',
		'Giannis Antetokounmpo',
		'Bucks vs. Knicks',
	],
	[
		'a1b2c3d4-0000-4000-8000-00000000e1f6',
		'over',
		6.5,
		'player_assists',
		'Jalen Brunson',
		'Bucks vs. Knicks',
	],
	[
		'a1b2c3d4-0000-4000-8000-00000000e1f7',
		'over',
		24.5,
		'player_points',
		'Anthony Edwards',
		'Timberwolves vs. Suns',
	],
] as const

const GAMES = [
	[
		'Los Angeles Lakers',
		'Boston Celtics',
		'2026-10-04T23:30:00Z',
		['LeBron James', 'Anthony Davis', 'Jayson Tatum', 'Jaylen Brown'],
	],
	[
		'Denver Nuggets',
		'Golden State Warriors',
		'2026-10-05T02:00:00Z',
		['Nikola Jokic', 'Jamal Murray', 'Stephen Curry', 'Draymond Green'],
	],
	[
		'Milwaukee Bucks',
		'New York Knicks',
		'2026-10-05T00:00:00Z',
		[
			'Giannis Antetokounmpo',
			'Damian Lillard',
			'Jalen Brunson',
			'Karl-Anthony Towns',
		],
	],
] as const
const MARKETS = [
	['player_points', 24.5],
	['player_rebounds', 9.5],
	['player_assists', 6.5],
	['player_threes', 2.5],
] as const

const dateGroups: DateGroupDto[] = [
	'2026-10-04T16:00:00Z',
	'2026-10-05T16:00:00Z',
].map((date, d) => ({
	date,
	games: GAMES.map(([away, home, time, players], g) => ({
		event_id: `evt-${d}-${g}`,
		matchup: `${away} @ ${home}`,
		away_team: away,
		home_team: home,
		commence_time: new Date(
			Date.parse(time) + d * 86_400_000,
		).toISOString(),
		sport_title: 'NBA',
		props: players.map((player, p) => ({
			outcome_uuid: `9f8e7d6c-${d}${g}${p}0-4000-8000-00000000${d}${g}${p}a`,
			market_key: MARKETS[p][0],
			description: player,
			point: MARKETS[p][1],
			prediction_count: 12 - p * 3 + g,
		})),
	})),
}))

const fixtures: ClusterFixtures = {
	cluster: 'admin',
	surfaces: [
		{
			id: 'F1',
			name: '/config footer status',
			before: () => ({
				embeds: [
					footerStatusEmbed({
						lastRefresh: ago(42),
						nextRefresh: new Date(
							FIXED.now.getTime() + 18 * 60_000,
						),
						ttl: '60 minutes',
						cacheSize: 31,
						categoryCounts: {
							core: 8,
							general: 6,
							betting: 9,
							props: 8,
						},
						hasAnnouncement: false,
					}),
				],
			}),
		},
		{
			id: 'F2',
			name: '/config view',
			before: () => ({
				embeds: [
					guildConfigViewEmbed({
						guildName: 'Pluto Sportsbook',
						defined: new Map([
							['GAMES_CATEGORY', '300000000000000010'],
							['BETTING_CHAN', '300000000000000003'],
							['PREDICTIONS_CHAN', '300000000000000005'],
							['LOGS_CHAN', '300000000000000004'],
						]),
						username: FIXED.username,
						avatarUrl: FIXED.avatarUrl,
					}),
				],
			}),
		},
		{
			id: 'F3',
			name: '/admin predictions view (page 1 of Sapphire paginator)',
			before: () =>
				firstPage(
					fieldsPaginator(
						predictionsTemplateEmbed(
							FIXED.username,
							FIXED.userId,
							PREDICTIONS.length,
						),
						PREDICTIONS.map(
							([id, choice, point, marketKey, player, match]) =>
								predictionField({
									id,
									choice,
									point,
									marketKey,
									outcomeDescription: player,
									match,
									date: '10/03/2026',
								}),
						),
					),
				),
		},
		{
			id: 'F4',
			name: '/admin predictions delete confirm',
			before: () => ({
				embeds: [
					predictionDeletedEmbed({
						id: PREDICTIONS[0][0],
						username: FIXED.username,
						userId: FIXED.userId,
						match: 'Lakers vs. Celtics',
						choice: 'over',
						date: '10/03/2026',
					}),
				],
			}),
		},
		{
			// Final state after the "Generating 10 player props…" placeholder is edited.
			id: 'F5',
			name: '/admin props generate (final)',
			before: () => ({
				content: '',
				embeds: [
					propsPostedEmbed(
						{ total: 10, posted: 9, failed: 1 },
						`<#${FIXED.channelId}>`,
					),
				],
			}),
		},
		{
			id: 'F6',
			name: '/admin props viewactive (page 1 of Sapphire paginator)',
			before: () => {
				const total = dateGroups.reduce(
					(n, dg) =>
						n + dg.games.reduce((m, g) => m + g.props.length, 0),
					0,
				)
				return firstPage(
					fieldsPaginator(
						activePropsEmbed(total, dateGroups.length),
						activePropsFields(dateGroups),
					),
				)
			},
		},
		{
			id: 'F7',
			name: 'AppLog log embed',
			before: () => ({
				embeds: [
					appLogEmbed(
						`${FIXED.username} posted 9 player prop embeds to prediction channel`,
						LogType.Info,
						FIXED.avatarUrl,
					),
				],
			}),
		},
		{
			id: 'F8',
			name: 'Command-error log',
			before: () => {
				const err = new Error('Request failed with status code 503')
				err.stack = [
					'Error: Request failed with status code 503',
					'    at PredictionApiWrapper.getActivePredictionsForUser (/app/dist/utils/api/Khronos/prediction/predictionApiWrapper.js:88:19)',
					'    at AdminPredictionsHandler.handleView (/app/dist/utils/admin-handlers/admin-predictions-handler.js:31:29)',
					'    at UserCommand.predictionsView (/app/dist/commands/admin/admin.js:142:9)',
					'    at Subcommand.chatInputRun (/app/node_modules/@sapphire/plugin-subcommands/dist/index.js:201:13)',
				].join('\n')
				return {
					embeds: [
						commandErrorLogEmbed(
							err,
							{
								commandName: 'admin',
								subcommandGroup: 'predictions',
								subcommand: 'view',
								userId: FIXED.userId,
								durationMs: 1284,
							},
							'/app',
						),
					],
				}
			},
		},
	],
}

export default fixtures
