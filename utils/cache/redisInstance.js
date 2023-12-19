import Redis from 'ioredis'
import { Log } from '#config'

Log.Yellow(
	`Connecting to Redis: ${process.env.R_HOST}:${process.env.R_PORT}`,
)

const redisCache = new Redis({
	host: process.env.R_HOST,
	port: parseInt(process.env.R_PORT, 10),
	password: process.env.R_PASS,
	connectTimeout: 10000, // Increase connection timeout to 10 seconds
	retryStrategy: (times) =>
		// Reconnect after a delay that increases with each failed attempt
		Math.min(times * 50, 2000),
	db: process.env.R_DB,
})

redisCache.on('connect', () => {
	Log.Green(
		`[REDIS] Connected to Redis server\nDB Selection: ${process.env.R_DB}`,
	)
})

redisCache.on('error', (err) => {
	throw new Error(err)
})

export default redisCache
