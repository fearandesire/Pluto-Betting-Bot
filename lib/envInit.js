/* eslint-disable import/extensions */
/**
 * @fileoverview
 * This file is used to initialize the environment for the application.
 */

import * as dotenv from 'dotenv'

import teamList from './teamList.js'
import getConfig from '../utils/db/fetchServerConfig.js'
import logClr from '#colorConsole'

// ? Toggle env based on dist
const envPath = (() => {
	switch (process.env.SERVERNAME) {
		case 'nfl':
			return './.env.nflc'
		case 'nba':
			return './.env.nbac'
		case 'nba-dev':
			return './.env.dev'
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

let { SERVERNAME } = process.env
if (SERVERNAME === 'dev') {
	SERVERNAME = 'nfl'
}

const {
	CONFIG_TBL,
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

const teams = teamList[SERVERNAME]

// # DB Stored Server Config
const serverConfig = await getConfig(CONFIG_TBL)

const { checkcompleted, schedulegames } = serverConfig

export {
	checkcompleted as CRON_CHECK_COMPLETED,
	schedulegames as CRON_SCHEDULE_GAMES,
}

export {
	teams,
	CONFIG_TBL,
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
