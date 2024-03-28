import db from '@pluto-db'
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
	BETSLIPS,
	CURRENCY,
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
	BETSLIPS,
	CURRENCY,
	server_ID,
	gameCat_ID,
	bettingChan,
	logChan,
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
}

export { configData as serverConf, serverEnv }
