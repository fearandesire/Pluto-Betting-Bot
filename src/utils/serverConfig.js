import * as dotenv from 'dotenv'
import db from '@pluto-db'

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

// # Retrieve server configuration on startup
const configResp = await db.oneOrNone(
	`SELECT config FROM serverconfigs WHERE serverid=$1`,
	[process.env.server_ID],
)
const configData = configResp.config

/**
 * DB Tables - Capitalized
 * IDs - Underscored
 * Anything else: camelCase
 */
const serverEnv = {
	ODDS: configData.ODDS,
	SCORE: configData.SCORE,
	RANGES: configData.RANGES,
	PENDING: configData.PENDING,
	BETSLIPS: configData.BETSLIPS,
	CURRENCY: configData.CURRENCY,
	LIVEBETS: configData.LIVEBETS,
	PROFILES: configData.PROFILES,
	LIVEMATCHUPS: configData.LIVEMATCHUPS,
	SCORETABLE: configData.SCORETABLE,
	EXPERIENCE: configData.EXPERIENCE,
	server_ID: configData.server_ID,
	gameCat_ID: configData.gameCat_ID,
	sportsLogo: configData.sportsLogo,
	bettingChan: configData.bettingChan,
	logChan: configData.logChan,
	statcordKey: configData.statcordKey,
	gameHeartbeat: configData.gameHeartbeat,
	scheduledGames: configData.scheduledGames,
	getRanges: configData.getRanges,
	getOdds: configData.getOdds,
	SPORT: configData.SPORT,
	R_HOST: configData.R_HOST,
	R_PORT: configData.R_PORT,
	R_DB: configData.R_DB,
	R_PASS: configData.R_PASS,
	SEASON_TYPE: configData.SEASON_TYPE,
	admin_token: configData.admin_token,
	pluto_api_url: configData.pluto_api_url,
	pluto_api_username: configData.pluto_api_username,
}

const {
	// DB Tables
	ODDS,
	SCORE,
	RANGES,
	PENDING,
	BETSLIPS,
	CURRENCY,
	PROFILES,
	LIVEMATCHUPS,
	SCORETABLE,
	LIVEBETS,
	// IDs
	server_ID,
	gameCat_ID,
	bettingChan,
	logChan,
	// Settings
	gameHeartbeat,
	SPORT,
	R_HOST,
	R_PORT,
	R_DB,
	R_PASS,
	SEASON_TYPE,
	admin_token,
	pluto_api_url,
	pluto_api_username,
} = serverEnv

export {
	ODDS,
	SCORE,
	RANGES,
	PENDING,
	BETSLIPS,
	CURRENCY,
	PROFILES,
	LIVEMATCHUPS,
	SCORETABLE,
	LIVEBETS,
	EXPERIENCE,
	server_ID,
	gameCat_ID,
	sportsLogo,
	bettingChan,
	logChan,
	statcordKey,
	gameHeartbeat,
	scheduledGames,
	getRanges,
	getOdds,
	SPORT,
	R_HOST,
	R_PORT,
	R_DB,
	R_PASS,
	SEASON_TYPE,
	admin_token,
	pluto_api_url,
	pluto_api_username,
}

export { configData as serverConf, serverEnv }
