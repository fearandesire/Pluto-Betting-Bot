import Redis from 'ioredis'
import { Log } from '#config'
import { R_HOST, R_PORT, R_PASS, R_DB } from '#serverConf'

Log.Yellow(
	`Connecting to Redis: ${process.env.R_HOST}:${process.env.R_PORT}`,
)

const redisCache = new Redis({
	host: R_HOST,
	port: Number(R_PORT),
	password: R_PASS,
	connectTimeout: 10000, // Increase connection timeout to 10 seconds
	retryStrategy: (times) =>
		// Reconnect after a delay that increases with each failed attempt
		Math.min(times * 50, 2000),
	db: R_DB,
})

redisCache.on('connect', () => {
	Log.Green(
		`[REDIS] Connected to Redis server\nDB Selection: ${R_DB}`,
	)
})

redisCache.on('error', (err) => {
	throw new Error(err)
})

export default redisCache
