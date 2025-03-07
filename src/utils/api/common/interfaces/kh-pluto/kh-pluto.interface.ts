/**
 * Supply additional information such as match opponent, date of matchup
 */
export interface IMatchInfoArgs {
	opponent: string;
	dateofmatchup: string;
}

export enum SportsServing {
	nba = 'nba',
	nfl = 'nfl',
}

export enum DiscordConfigEnums {
	GAMES_CATEGORY = 'GAMES_CATEGORY',
	BETTING_CHANNEL = 'BETTING_CHAN',
	DAILY_SCHEDULE_CHAN = 'DAILY_SCHEDULE_CHAN',
	PREDICTIONS_CHAN = 'PREDICTIONS_CHAN',
	LOGS_CHAN = 'LOGS_CHAN',
	//	LOGS_ENABLED = 'LOGS_ENABLED',
}

export type KH_ValidConfigType =
	| `BETTING_CHAN`
	| `LOGS`
	| `GAMES_CATEGORY`
	| `SECURITY`
	| 'DAILY_SCHEDULE_CHAN';

// Match aggregation | Expected structure from Khronos
// Used for daily schedule parsing and posting
export interface IMatchupAggregated {
	id: string;
	sport_title: string;
	commence_time: string;
	home_team: string;
	away_team: string;
	last_update: string;
	home_team_odds: number;
	away_team_odds: number;
	winner: string | null;
	loser: string | null;
	dateofmatchup: string;
	legiblestart: string;
	cron_timer: string;
	closing_bets: boolean;
	broadcastInfo: string[];
	teamRecords: string[];
}

export interface IConfigRow {
	rowid: number;
	guild_id: string;
	setting_type: string;
	setting_value: string;
	sport: string;
}

export interface ICategoryData {
	[key: string]: IConfigRow[];
}

export const plutoWelcomeMsg =
	'**Welcome to Pluto!**\n`👁️` - View games to bet on using `/odds`\n`✅` - Place bets using `/bet`\n\nFind out more via `commands`';
