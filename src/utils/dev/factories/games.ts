import { faker } from '@faker-js/faker'
import type {
	GetAllMatchesDto,
	GetAllMatchesDtoMatchesInner,
} from '@kh-openapi'
import { type MockSport, pickMatchup } from './teams.js'

function makeOdds(): { home: number; away: number } {
	const favored = faker.number.int({ min: -280, max: -115 })
	const underdog = faker.number.int({ min: 105, max: 280 })
	return faker.datatype.boolean()
		? { home: favored, away: underdog }
		: { home: underdog, away: favored }
}

export function makeUpcomingGame(options: {
	sport: MockSport
	hoursFromNow?: number
	id?: string
}): GetAllMatchesDtoMatchesInner {
	const { home, away } = pickMatchup(options.sport)
	const odds = makeOdds()

	return {
		id: options.id ?? faker.string.uuid(),
		sport: options.sport,
		sport_title: options.sport.toUpperCase(),
		home_team: home,
		away_team: away,
		commence_time: new Date(
			Date.now() + (options.hoursFromNow ?? 6) * 3_600_000,
		).toISOString(),
		home_team_odds: odds.home,
		away_team_odds: odds.away,
		status: 'scheduled',
	}
}

export function makeMatchesForSport(
	sport: MockSport,
	count = 5,
): GetAllMatchesDto {
	return {
		statusCode: 200,
		matches: Array.from({ length: count }, (_, index) =>
			makeUpcomingGame({ sport, hoursFromNow: index + 2 }),
		),
	}
}
