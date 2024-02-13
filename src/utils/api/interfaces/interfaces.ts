/**
 * Supply additional information such as match opponent, date of matchup
 */
export interface ApiMatchInfo {
	opponent: string
	dateofmatchup: string
}

export enum SportsServing {
	nba = 'nba',
	nfl = 'nfl',
}

export type KH_ValidConfigType =
	| `BETTING_CHAN`
	| `LOGS`
	| `GAMES_CATEGORY`
	| `SECURITY`
	| 'DAILY_SCHEDULE_CHAN'

// Standard structure of a match
export interface Matchup {
	id: string
	sport_title: string
	commence_time: string
	home_team: string
	away_team: string
	last_update: string
	home_team_odds: number
	away_team_odds: number
	winner: string | null
	loser: string | null
	dateofmatchup: string
	legiblestart: string
	cron_timer: string
	closing_bets: boolean
}

// Match aggregation | Expected structure from Khronos
// Used for daily schedule parsing and posting
export interface IMatchupAggregated {
	id: string
	sport_title: string
	commence_time: string
	home_team: string
	away_team: string
	last_update: string
	home_team_odds: number
	away_team_odds: number
	winner: string | null
	loser: string | null
	dateofmatchup: string
	legiblestart: string
	cron_timer: string
	closing_bets: boolean
	broadcastInfo: string[]
	teamRecords: string[]
}

export interface IConfigRow {
	rowid: number
	guild_id: string
	setting_type: string
	setting_value: string
	sport: string
}

export interface ICategoryData {
	[key: string]: IConfigRow[]
}
