/* eslint-disable import/extensions */
/**
 * @fileoverview
 * This file is used to initialize the environment for the application.
 */

import * as dotenv from 'dotenv'

import teamList from './teamList.js'

// ? This enables the ability to switch the .env files based on the npm script ran aka the distro selected to launch.
const envPath = (() => {
	switch (process.env.SERVERNAME) {
		case 'nfl':
			return './.env.nflc'
		case 'nba':
			return './.env.nbac'
		default:
			return './.env.dev'
	}
})()

dotenv.config({
	path: envPath,
	override: true,
})

console.log(`[Server] ${process.env.SERVERNAME}`)

console.log(
	`[Startup]: Initializing Pluto\nEnv Path: ${envPath}`,
)

// ? Exporting env variable constants since dotenv is used here

// # Team list for either team
let { SERVERNAME } = process.env
if (SERVERNAME === 'dev') {
	SERVERNAME = 'nba'
}
export const teams = teamList[SERVERNAME]

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
}
