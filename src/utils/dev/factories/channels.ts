import { faker } from '@faker-js/faker'
import type { GetAllMatchesDtoMatchesInner } from '@kh-openapi'
import type {
	IncomingChannelData,
	TeamMatchupRecords,
} from '../../cache/data/schemas.js'
import { makeUpcomingGame } from './games.js'
import type { MockSport } from './teams.js'

function shortName(team: string): string {
	const parts = team.split(' ')
	return parts[parts.length - 1]?.toLowerCase() ?? team.toLowerCase()
}

function makeTeamRecords(options: {
	home: string
	away: string
	playoffs: boolean
}): TeamMatchupRecords {
	return {
		home_team: {
			display_name: options.home,
			abbreviation: shortName(options.home).slice(0, 3).toUpperCase(),
			total_record: `${faker.number.int({ min: 35, max: 62 })}-${faker.number.int({ min: 20, max: 47 })}`,
			home_record: `${faker.number.int({ min: 18, max: 34 })}-${faker.number.int({ min: 7, max: 22 })}`,
			playoff_record: options.playoffs
				? `${faker.number.int({ min: 1, max: 8 })}-${faker.number.int({ min: 0, max: 5 })}`
				: null,
		},
		away_team: {
			display_name: options.away,
			abbreviation: shortName(options.away).slice(0, 3).toUpperCase(),
			total_record: `${faker.number.int({ min: 35, max: 62 })}-${faker.number.int({ min: 20, max: 47 })}`,
			away_record: `${faker.number.int({ min: 16, max: 30 })}-${faker.number.int({ min: 9, max: 25 })}`,
			playoff_record: options.playoffs
				? `${faker.number.int({ min: 1, max: 8 })}-${faker.number.int({ min: 0, max: 5 })}`
				: null,
		},
		series: options.playoffs
			? {
					round: 'Conference Semifinals',
					summary: 'Series tied 1-1',
					home_wins: 1,
					away_wins: 1,
					total_games: 7,
					completed: false,
				}
			: null,
	}
}

function makeChannelName(game: GetAllMatchesDtoMatchesInner): string {
	return `${shortName(game.away_team ?? 'away')}-at-${shortName(
		game.home_team ?? 'home',
	)}`
}

export function makeChannelPayload(options: {
	sport: MockSport
	guildId: string
	bettingChannelId: string
	gameCategoryId: string
	playoffs?: boolean
	count?: number
}): IncomingChannelData {
	const channels = Array.from({ length: options.count ?? 1 }, (_, index) => {
		const game = makeUpcomingGame({
			sport: options.sport,
			hoursFromNow: index + 2,
		})
		const homeOdds = game.home_team_odds ?? -130
		const awayOdds = game.away_team_odds ?? 110
		const favored =
			homeOdds < awayOdds
				? (game.home_team ?? 'Home Team')
				: (game.away_team ?? 'Away Team')

		return {
			id: game.id ?? faker.string.uuid(),
			sport: options.sport as IncomingChannelData['channels'][number]['sport'],
			created: false,
			gametime: new Date(game.commence_time ?? Date.now()),
			channelname: makeChannelName(game),
			matchOdds: {
				favored,
				home_team_odds: homeOdds,
				away_team_odds: awayOdds,
			},
			home_team: game.home_team ?? 'Home Team',
			away_team: game.away_team ?? 'Away Team',
			metadata: {
				headline: options.playoffs
					? 'Playoff Game 3 - Series tied 1-1'
					: null,
				records: makeTeamRecords({
					home: game.home_team ?? 'Home Team',
					away: game.away_team ?? 'Away Team',
					playoffs: options.playoffs ?? false,
				}),
			},
		}
	})

	return {
		channels,
		guilds: [
			{
				guildId: options.guildId,
				eligibleMatches: channels.map((channel) => channel.id),
				bettingChannelId: options.bettingChannelId,
				gameCategoryId: options.gameCategoryId,
				sport: options.sport,
			},
		],
	}
}
