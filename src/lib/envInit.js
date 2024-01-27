/**
 * @fileoverview
 * This file is used to initialize the environment for the application.
 */

import * as dotenv from 'dotenv'
import logClr from '@pluto-internal-color-logger'

const { SERVERNAME } = process.env
// ? Toggle env based on dist
const envPath = (() => {
	switch (SERVERNAME) {
		case 'nfl':
			return './.env.nflc'
		case 'nba':
			return './.env.nbac'
		case 'nba-dev':
			return './.env.dev.nflc'
		case 'nfl-dev':
			return './.env.dev.nflc'
		default:
			return './.env.dev'
	}
})()

dotenv.config({
	path: envPath,
	override: true,
})

logClr({
	text: `[Startup]: Initializing Pluto\nEnv Path: ${envPath}\n[Server] ${process.env.SERVERNAME}`,
	status: `processing`,
	color: `yellow`,
})

const {
	SCHEDULE_TIMER,
	CHECK_COMPLETED_TIMER,
	LIVEMATCHUPS,
	LIVEBETS,
	BETSLIPS,
	PROFILES,
	PENDING,
	SCORE,
	ODDS,
	CURRENCY,
	RANGES,
	GOOGLE_CUSTOM,
	EXP_PORT,
	COLUMN_MATCHUPS_DATE,
	COLUMN_MATCHUPS_HOME_TEAM,
	COLUMN_MATCHUPS_AWAY_TEAM,
	PRESZN_MATCHUPS_TABLE,
	SEASON_TYPE,
	server_ID,
	SPORT,
} = process.env

export {
	SCHEDULE_TIMER,
	CHECK_COMPLETED_TIMER,
	LIVEMATCHUPS,
	LIVEBETS,
	BETSLIPS,
	PROFILES,
	PENDING,
	SCORE,
	ODDS,
	CURRENCY,
	RANGES,
	GOOGLE_CUSTOM,
	EXP_PORT,
	COLUMN_MATCHUPS_DATE,
	COLUMN_MATCHUPS_HOME_TEAM,
	COLUMN_MATCHUPS_AWAY_TEAM,
	PRESZN_MATCHUPS_TABLE,
	SEASON_TYPE,
	server_ID,
	SPORT,
}
