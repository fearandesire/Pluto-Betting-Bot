import { db } from '#db'

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
	server_ID: configData.server_ID,
	gameCat_ID: configData.gameCat_ID,
	sportsLogo: configData.sportsLogo,
	bettingChan: configData.bettingChan,
	logChan: configData.logChan,
	statcordKey: configData.statcordKey,
	gameHeartbeat: configData.gameHeartbeat,
	scheduledGames: configData.scheduledGames,
	getRanges: configData.getRanges,
}

const {
	ODDS,
	SCORE,
	RANGES,
	PENDING,
	BETSLIPS,
	CURRENCY,
	PROFILES,
	LIVEMATCHUPS,
	SCORETABLE,
	server_ID,
	gameCat_ID,
	sportsLogo,
	bettingChan,
	logChan,
	statcordKey,
	gameHeartbeat,
	scheduledGames,
	getRanges,
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
	server_ID,
	gameCat_ID,
	sportsLogo,
	bettingChan,
	logChan,
	statcordKey,
	gameHeartbeat,
	scheduledGames,
	getRanges,
}

export { configData as serverConf, serverEnv }
