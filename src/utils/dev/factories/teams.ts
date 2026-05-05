import { faker } from '@faker-js/faker'

export type MockSport = 'nba' | 'nfl'

export const MOCK_SPORTS = ['nba', 'nfl'] as const

export const TEAMS: Record<MockSport, string[]> = {
	nba: [
		'Atlanta Hawks',
		'Boston Celtics',
		'Brooklyn Nets',
		'Chicago Bulls',
		'Cleveland Cavaliers',
		'Dallas Mavericks',
		'Denver Nuggets',
		'Golden State Warriors',
		'Los Angeles Lakers',
		'Miami Heat',
		'Milwaukee Bucks',
		'Minnesota Timberwolves',
		'New York Knicks',
		'Oklahoma City Thunder',
		'Philadelphia 76ers',
		'Phoenix Suns',
		'Sacramento Kings',
		'Toronto Raptors',
	],
	nfl: [
		'Baltimore Ravens',
		'Buffalo Bills',
		'Cincinnati Bengals',
		'Dallas Cowboys',
		'Denver Broncos',
		'Detroit Lions',
		'Green Bay Packers',
		'Kansas City Chiefs',
		'Las Vegas Raiders',
		'Los Angeles Chargers',
		'Los Angeles Rams',
		'Miami Dolphins',
		'New York Giants',
		'Philadelphia Eagles',
		'Pittsburgh Steelers',
		'San Francisco 49ers',
		'Seattle Seahawks',
		'Tampa Bay Buccaneers',
	],
}

export function asMockSport(value: string | undefined): MockSport {
	return value === 'nfl' ? 'nfl' : 'nba'
}

export function pickMatchup(sport: MockSport): {
	home: string
	away: string
} {
	const teams = TEAMS[sport]
	const home = faker.helpers.arrayElement(teams)
	const away = faker.helpers.arrayElement(
		teams.filter((team) => team !== home),
	)
	return { home, away }
}
