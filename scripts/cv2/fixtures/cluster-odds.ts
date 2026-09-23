import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { MatchDetailDto } from '@pluto-khronos/api-client'
import {
	dailyScheduleEmbed,
	matchPostEmbed,
	scheduleGameLine,
} from '../../../src/lib/discord/builders/odds.js'
import type { IMatchupAggregated } from '../../../src/utils/api/common/interfaces/kh-pluto/kh-pluto.interface.js'
import { prepareAndFormat } from '../../../src/utils/matches/OddsProcessing.js'
import { type ClusterFixtures, FIXED } from './types.js'

// NFL Week 5 slate around FIXED.now (Sun 2026-10-04 19:30Z).
// No guild emojis offline: B2/B3 use each path's no-emoji fallback.
const guildIcon = `https://cdn.discordapp.com/icons/${FIXED.guildId}/0b1c2d3e4f.jpg`

const match = (
	home_team: string,
	away_team: string,
	home_team_odds: number,
	away_team_odds: number,
	commence_time: string,
): MatchDetailDto => ({
	id: `${away_team}@${home_team}`,
	sport_title: 'NFL',
	status: 'upcoming',
	home_team,
	away_team,
	home_team_odds,
	away_team_odds,
	commence_time,
})

const slate: MatchDetailDto[] = [
	match(
		'Kansas City Chiefs',
		'Buffalo Bills',
		-135,
		115,
		'2026-10-04T20:25:00Z',
	),
	match(
		'Dallas Cowboys',
		'Philadelphia Eagles',
		120,
		-140,
		'2026-10-04T20:25:00Z',
	),
	match(
		'San Francisco 49ers',
		'Los Angeles Rams',
		-180,
		155,
		'2026-10-05T00:20:00Z',
	),
	match(
		'Green Bay Packers',
		'Detroit Lions',
		105,
		-125,
		'2026-10-06T00:15:00Z',
	),
	match(
		'Baltimore Ravens',
		'Cincinnati Bengals',
		-210,
		175,
		'2026-10-08T00:15:00Z',
	),
]

const game = (
	home_team: string,
	away_team: string,
	commence_time: string,
	teamRecords: [home: string, away: string],
): IMatchupAggregated => ({
	id: `${away_team}@${home_team}`,
	sport_title: 'NFL',
	commence_time,
	home_team,
	away_team,
	last_update: FIXED.now.toISOString(),
	home_team_odds: -135,
	away_team_odds: 115,
	winner: null,
	loser: null,
	dateofmatchup: '10/04/2026',
	legiblestart: '',
	cron_timer: '',
	closing_bets: false,
	broadcastInfo: [],
	teamRecords,
})

const today: IMatchupAggregated[] = [
	game('Kansas City Chiefs', 'Buffalo Bills', '2026-10-04T20:25:00Z', [
		'3-1',
		'4-0',
	]),
	game('Dallas Cowboys', 'Philadelphia Eagles', '2026-10-04T20:25:00Z', [
		'2-2',
		'3-1',
	]),
	game('San Francisco 49ers', 'Los Angeles Rams', '2026-10-05T00:20:00Z', [
		'3-1',
		'2-2',
	]),
]

const matchJpg = `data:image/jpeg;base64,${readFileSync(
	path.resolve(__dirname, 'images/match-placeholder.jpg'),
).toString('base64')}`

const fixtures: ClusterFixtures = {
	cluster: 'odds',
	surfaces: [
		{
			id: 'B1',
			name: '/odds board',
			before: async () => ({
				embeds: [
					await prepareAndFormat(slate, guildIcon, FIXED.guildId),
				],
			}),
		},
		{
			id: 'B2',
			name: 'Daily schedule',
			before: () => {
				// GameSchedule.parseAndFormat: one line per game, trailing \n.
				const desc = today
					.map(
						(g) =>
							`${scheduleGameLine(g, { home: null, away: null })}\n`,
					)
					.join('')
				return { embeds: [dailyScheduleEmbed(desc)] }
			},
		},
		{
			id: 'B3',
			name: 'Game-channel match post',
			before: () => {
				const embed = matchPostEmbed(
					{
						favored: 'Kansas City Chiefs',
						favoredTeamClr: '#E31837',
						home_team: 'Kansas City Chiefs',
						homeTeamShortName: 'Chiefs',
						away_team: 'Buffalo Bills',
						awayTeamShortName: 'Bills',
						bettingChanId: FIXED.channelId,
						header: '',
						sport: 'nfl',
						records: {
							home_team: { total_record: '3-1' },
							away_team: { total_record: '4-0' },
						},
					},
					'',
				)
				// ChannelManager.prepareGameMessage attaches the matchup image.
				embed.setImage('attachment://match.jpg')
				return {
					embeds: [embed],
					files: [{ name: 'match.jpg', url: matchJpg }],
				}
			},
		},
	],
}

export default fixtures
