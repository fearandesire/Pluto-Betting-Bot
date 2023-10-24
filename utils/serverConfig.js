import * as dotenv from 'dotenv'
import { db } from '#db'

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
}

// console.log(`serverEnv =>\n`, serverEnv)

const {
	// Tables
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
	// IDs
	server_ID,
	gameCat_ID,
	sportsLogo,
	bettingChan,
	logChan,
	statcordKey,
	// Settings
	gameHeartbeat,
	scheduledGames,
	getRanges,
	getOdds,
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
}

export { configData as serverConf, serverEnv }
