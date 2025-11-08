import { default as Redis } from 'ioredis' // Issue from https://github.com/redis/ioredis/issues/1624
import { logger } from '../logging/WinstonLogger.js'

const { R_HOST, R_PORT, R_PASS, R_DB } = process.env

logger.info({
	message: `Connecting to Redis: ${R_HOST}:${R_PORT}`,
	source: 'startup:redis',
})

const MAX_RETRY_ATTEMPTS = 3 // Set the maximum number of retry attempts
// @ts-ignore
const redisCache = new Redis({
	host: R_HOST,
	port: Number(R_PORT),
	password: R_PASS,
	connectTimeout: 10000,
	retryStrategy: (times) => {
		if (times >= MAX_RETRY_ATTEMPTS) {
			throw new Error('Max retry attempts reached')
		}
		return Math.min(2 ** times * 1000, 60000)
	},
	db: Number(R_DB),
})

redisCache.on('error', (err) => {
	logger.error({
		message: err,
		source: 'startup:redis',
	})
	process.exit(1)
})

export default redisCache
