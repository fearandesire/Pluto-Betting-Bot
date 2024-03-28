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
	logChan: configData.logChan,
	R_HOST: configData.R_HOST,
	R_PORT: configData.R_PORT,
	R_DB: configData.R_DB,
	R_PASS: configData.R_PASS,
	pluto_api_url: configData.pluto_api_url,
}

const {
	// DB Tables
	// IDs
	logChan,
	// Settings
	R_HOST,
	R_PORT,
	R_DB,
	R_PASS,
	pluto_api_url,
} = serverEnv

export { logChan, R_HOST, R_PORT, R_DB, R_PASS, pluto_api_url }

export { configData as serverConf, serverEnv }
