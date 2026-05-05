import { default as Redis, type Redis as RedisClient } from 'ioredis' // Issue from https://github.com/redis/ioredis/issues/1624
import env from '../../lib/startup/env.js'
import { logger } from '../logging/WinstonLogger.js'

const { R_HOST, R_PORT, R_PASS, R_DB } = process.env

// InMemoryRedis is a mock Redis client for testing. Note: expire() is a stub
// that always returns 1 and does not enforce TTL on keys.
class InMemoryRedis {
	private readonly values = new Map<string, string>()
	private readonly hashes = new Map<string, Map<string, string>>()
	private readonly sets = new Map<string, Set<string>>()

	async set(key: string, value: string, ..._rest: unknown[]) {
		this.values.set(key, value)
		return 'OK'
	}

	async get(key: string) {
		return this.values.get(key) ?? null
	}

	async del(...keys: string[]) {
		let deleted = 0
		for (const key of keys) {
			if (this.values.delete(key)) deleted++
			if (this.hashes.delete(key)) deleted++
			if (this.sets.delete(key)) deleted++
		}
		return deleted
	}

	async flushall() {
		this.values.clear()
		this.hashes.clear()
		this.sets.clear()
		return 'OK'
	}

	async exists(key: string) {
		return this.values.has(key) ||
			this.hashes.has(key) ||
			this.sets.has(key)
			? 1
			: 0
	}

	async incr(key: string) {
		const next = Number(this.values.get(key) ?? 0) + 1
		this.values.set(key, String(next))
		return next
	}

	async expire(_key: string, _seconds: number) {
		// Stub for testing: always returns 1, does not actually expire keys
		return 1
	}

	async setex(key: string, _seconds: number, value: string) {
		this.values.set(key, value)
		return 'OK'
	}

	async hset(key: string, field: string, value: string) {
		const hash = this.hashes.get(key) ?? new Map<string, string>()
		const isNew = hash.has(field) ? 0 : 1
		hash.set(field, value)
		this.hashes.set(key, hash)
		return isNew
	}

	async hgetall(key: string) {
		return Object.fromEntries(this.hashes.get(key) ?? [])
	}

	async sadd(key: string, ...members: string[]) {
		const set = this.sets.get(key) ?? new Set<string>()
		let added = 0
		for (const member of members) {
			if (!set.has(member)) added++
			set.add(member)
		}
		this.sets.set(key, set)
		return added
	}

	async smembers(key: string) {
		return [...(this.sets.get(key) ?? [])]
	}

	pipeline() {
		const commands: Array<() => Promise<unknown>> = []
		const pipeline = {
			set: (key: string, value: string) => {
				commands.push(() => this.set(key, value))
				return pipeline
			},
			del: (...keys: string[]) => {
				commands.push(() => this.del(...keys))
				return pipeline
			},
			hset: (key: string, field: string, value: string) => {
				commands.push(() => this.hset(key, field, value))
				return pipeline
			},
			expire: (key: string, seconds: number) => {
				commands.push(() => this.expire(key, seconds))
				return pipeline
			},
			exec: async () =>
				Promise.all(
					commands.map(async (command) => {
						try {
							const result = await command()
							return [null, result] as [null, unknown]
						} catch (error) {
							return [error, null] as [Error, null]
						}
					}),
				),
		}
		return pipeline
	}
}

const redisCache = env.USE_MOCK_DATA
	? (new InMemoryRedis() as unknown as RedisClient)
	: // @ts-ignore - ioredis default export is constructable at runtime.
		new Redis({
			host: R_HOST,
			port: Number(R_PORT),
			password: R_PASS,
			connectTimeout: 10000,
			retryStrategy: (times) => {
				const MAX_RETRY_ATTEMPTS = 3
				if (times >= MAX_RETRY_ATTEMPTS) {
					throw new Error('Max retry attempts reached')
				}
				return Math.min(2 ** times * 1000, 60000)
			},
			db: Number(R_DB),
		})

if (env.USE_MOCK_DATA) {
	logger.info({
		message: 'Using in-memory Redis replacement for mock data mode',
		source: 'startup:redis',
	})
} else {
	logger.info({
		message: `Connecting to Redis: ${R_HOST}:${R_PORT}`,
		source: 'startup:redis',
	})
	redisCache.on('error', (err) => {
		logger.error({
			message: err,
			source: 'startup:redis',
		})
		process.exit(1)
	})
}

export default redisCache
