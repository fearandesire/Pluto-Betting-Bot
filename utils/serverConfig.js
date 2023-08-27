import { db } from '#db'

// # Create a function to retrieve the server config from tbl `serverconfigs`. Retrieve via 'serverid' column
const configResp = await db.oneOrNone(
	`SELECT config FROM serverconfigs WHERE serverid=$1`,
	[process.env.server_ID],
)

const configData = configResp.config

export { configData as serverConf }
