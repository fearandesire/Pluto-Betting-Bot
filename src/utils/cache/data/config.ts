import env from '../../../lib/startup/env.js'
export const REDIS_CONFIG = {
	host: env.R_HOST,
	port: Number(env.R_PORT),
	password: env.R_PASS,
}
