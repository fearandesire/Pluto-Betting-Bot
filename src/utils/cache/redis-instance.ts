import {
	type ChainableCommander,
	default as Redis,
	type Redis as RedisClient,
	type RedisOptions,
} from 'ioredis' // Issue from https://github.com/redis/ioredis/issues/1624
import env from '../../lib/startup/env.js'
import { logger } from '../logging/WinstonLogger.js'

const { R_HOST, R_PORT, R_PASS, R_DB } = process.env

const RedisConstructor = Redis as unknown as {
	new (options: RedisOptions): RedisClient
}

export interface AtomicCacheOperations {
	compareAndRemove(key: string, expectedValue: string): Promise<boolean>
	refreshIfOwned(
		key: string,
		expectedValue: string,
		seconds: number,
	): Promise<boolean>
	transitionIfValue(
		key: string,
		expectedValue: string,
		nextValue: string,
		seconds?: number,
	): Promise<boolean>
}

export interface RedisCacheClient extends AtomicCacheOperations {
	set(
		key: string,
		value: string,
		...args: Array<string | number>
	): Promise<'OK' | null>
	get(key: string): Promise<string | null>
	del(...keys: string[]): Promise<number>
	flushall(): Promise<'OK'>
	exists(key: string): Promise<number>
	incr(key: string): Promise<number>
	decr(key: string): Promise<number>
	expire(key: string, seconds: number): Promise<number>
	setex(key: string, seconds: number, value: string): Promise<'OK'>
	ttl(key: string): Promise<number>
	hset(key: string, field: string, value: string): Promise<number>
	hgetall(key: string): Promise<Record<string, string>>
	sadd(key: string, ...members: string[]): Promise<number>
	smembers(key: string): Promise<string[]>
	pipeline(): ChainableCommander
	on(event: 'error', listener: (error: Error) => void): RedisCacheClient
	quit(): Promise<string>
}

const COMPARE_AND_REMOVE_SCRIPT = `
if redis.call('get', KEYS[1]) == ARGV[1] then
  return redis.call('del', KEYS[1])
end
return 0`

const REFRESH_IF_OWNED_SCRIPT = `
if redis.call('get', KEYS[1]) == ARGV[1] then
  return redis.call('expire', KEYS[1], ARGV[2])
end
return 0`

const TRANSITION_IF_VALUE_SCRIPT = `
if redis.call('get', KEYS[1]) ~= ARGV[1] then
  return 0
end
if ARGV[3] == '' then
  redis.call('set', KEYS[1], ARGV[2], 'KEEPTTL')
else
  redis.call('set', KEYS[1], ARGV[2], 'EX', ARGV[3])
end
return 1`

const requirePositiveSeconds = (seconds: number): void => {
	if (!Number.isSafeInteger(seconds) || seconds <= 0) {
		throw new RangeError('Redis expiry must be a positive integer.')
	}
}

export function createAtomicRedisClient(client: RedisClient): RedisCacheClient {
	return Object.assign(client, {
		async compareAndRemove(key: string, expectedValue: string) {
			const result = await client.eval(
				COMPARE_AND_REMOVE_SCRIPT,
				1,
				key,
				expectedValue,
			)
			return Number(result) === 1
		},
		async refreshIfOwned(
			key: string,
			expectedValue: string,
			seconds: number,
		) {
			requirePositiveSeconds(seconds)
			const result = await client.eval(
				REFRESH_IF_OWNED_SCRIPT,
				1,
				key,
				expectedValue,
				seconds,
			)
			return Number(result) === 1
		},
		async transitionIfValue(
			key: string,
			expectedValue: string,
			nextValue: string,
			seconds?: number,
		) {
			if (seconds !== undefined) requirePositiveSeconds(seconds)
			const result = await client.eval(
				TRANSITION_IF_VALUE_SCRIPT,
				1,
				key,
				expectedValue,
				nextValue,
				seconds ?? '',
			)
			return Number(result) === 1
		},
	}) as unknown as RedisCacheClient
}

type Clock = () => number

export class InMemoryRedis implements RedisCacheClient {
	private readonly values = new Map<string, string>()
	private readonly hashes = new Map<string, Map<string, string>>()
	private readonly sets = new Map<string, Set<string>>()
	private readonly expiresAt = new Map<string, number>()

	constructor(private readonly now: Clock = Date.now) {}

	async set(
		key: string,
		value: string,
		...rest: Array<string | number>
	): Promise<'OK' | null> {
		let ttlMs: number | undefined
		let onlyIfAbsent = false
		let keepTtl = false
		for (let index = 0; index < rest.length; index++) {
			const option = String(rest[index]).toUpperCase()
			if (option === 'NX') {
				onlyIfAbsent = true
				continue
			}
			if (option === 'KEEPTTL') {
				keepTtl = true
				continue
			}
			if (option === 'EX' || option === 'PX') {
				const amount = Number(rest[++index])
				if (!Number.isSafeInteger(amount) || amount <= 0) {
					throw new RangeError(
						'Redis expiry must be a positive integer.',
					)
				}
				ttlMs = option === 'EX' ? amount * 1000 : amount
				continue
			}
			throw new Error(`Unsupported in-memory Redis SET option: ${option}`)
		}
		this.purgeExpired(key)
		if (onlyIfAbsent && this.hasKey(key)) return null
		const previousExpiry = this.expiresAt.get(key)
		this.hashes.delete(key)
		this.sets.delete(key)
		this.values.set(key, value)
		if (ttlMs !== undefined) {
			this.expiresAt.set(key, this.now() + ttlMs)
		} else if (keepTtl && previousExpiry !== undefined) {
			this.expiresAt.set(key, previousExpiry)
		} else {
			this.expiresAt.delete(key)
		}
		return 'OK'
	}

	async get(key: string) {
		this.purgeExpired(key)
		return this.values.get(key) ?? null
	}

	async del(...keys: string[]) {
		let deleted = 0
		for (const key of keys) {
			this.purgeExpired(key)
			if (this.removeKey(key)) deleted++
		}
		return deleted
	}

	async flushall(): Promise<'OK'> {
		this.values.clear()
		this.hashes.clear()
		this.sets.clear()
		this.expiresAt.clear()
		return 'OK'
	}

	async exists(key: string) {
		return this.hasKey(key) ? 1 : 0
	}

	async incr(key: string) {
		this.purgeExpired(key)
		const next = Number(this.values.get(key) ?? 0) + 1
		this.values.set(key, String(next))
		return next
	}

	async decr(key: string) {
		this.purgeExpired(key)
		const next = Number(this.values.get(key) ?? 0) - 1
		this.values.set(key, String(next))
		return next
	}

	async expire(key: string, seconds: number) {
		if (!Number.isSafeInteger(seconds)) {
			throw new RangeError('Redis expiry must be an integer.')
		}
		if (!this.hasKey(key)) return 0
		if (seconds <= 0) {
			this.removeKey(key)
			return 1
		}
		this.expiresAt.set(key, this.now() + seconds * 1000)
		return 1
	}

	async setex(key: string, seconds: number, value: string): Promise<'OK'> {
		await this.set(key, value, 'EX', seconds)
		return 'OK'
	}

	async ttl(key: string): Promise<number> {
		this.purgeExpired(key)
		if (!this.hasKey(key)) return -2
		const expiresAt = this.expiresAt.get(key)
		if (expiresAt === undefined) return -1
		return Math.round((expiresAt - this.now()) / 1000)
	}

	async hset(key: string, field: string, value: string) {
		this.purgeExpired(key)
		const hash = this.hashes.get(key) ?? new Map<string, string>()
		const isNew = hash.has(field) ? 0 : 1
		hash.set(field, value)
		this.hashes.set(key, hash)
		return isNew
	}

	async hgetall(key: string) {
		this.purgeExpired(key)
		return Object.fromEntries(this.hashes.get(key) ?? [])
	}

	async sadd(key: string, ...members: string[]) {
		this.purgeExpired(key)
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
		this.purgeExpired(key)
		return [...(this.sets.get(key) ?? [])]
	}

	async compareAndRemove(
		key: string,
		expectedValue: string,
	): Promise<boolean> {
		this.purgeExpired(key)
		if (this.values.get(key) !== expectedValue) return false
		this.removeKey(key)
		return true
	}

	async refreshIfOwned(
		key: string,
		expectedValue: string,
		seconds: number,
	): Promise<boolean> {
		requirePositiveSeconds(seconds)
		this.purgeExpired(key)
		if (this.values.get(key) !== expectedValue) return false
		this.expiresAt.set(key, this.now() + seconds * 1000)
		return true
	}

	async transitionIfValue(
		key: string,
		expectedValue: string,
		nextValue: string,
		seconds?: number,
	): Promise<boolean> {
		if (seconds !== undefined) requirePositiveSeconds(seconds)
		this.purgeExpired(key)
		if (this.values.get(key) !== expectedValue) return false
		this.values.set(key, nextValue)
		if (seconds !== undefined) {
			this.expiresAt.set(key, this.now() + seconds * 1000)
		}
		return true
	}

	async eval(..._args: unknown[]): Promise<never> {
		throw new Error(
			'Raw Redis eval is unsupported in mock mode; use typed atomic operations.',
		)
	}

	pipeline(): ChainableCommander {
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
		return pipeline as unknown as ChainableCommander
	}

	on(_event: 'error', _listener: (error: Error) => void): RedisCacheClient {
		return this
	}

	async quit(): Promise<string> {
		return 'OK'
	}

	private hasKey(key: string): boolean {
		this.purgeExpired(key)
		return (
			this.values.has(key) || this.hashes.has(key) || this.sets.has(key)
		)
	}

	private purgeExpired(key: string): void {
		const expiresAt = this.expiresAt.get(key)
		if (expiresAt !== undefined && expiresAt <= this.now()) {
			this.removeKey(key)
		}
	}

	private removeKey(key: string): boolean {
		const existed =
			this.values.has(key) || this.hashes.has(key) || this.sets.has(key)
		this.values.delete(key)
		this.hashes.delete(key)
		this.sets.delete(key)
		this.expiresAt.delete(key)
		return existed
	}
}

const redisCache: RedisCacheClient = env.USE_MOCK_DATA
	? new InMemoryRedis()
	: createAtomicRedisClient(
			new RedisConstructor({
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
			}),
		)

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
