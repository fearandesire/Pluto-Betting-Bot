import Redis, { type Redis as RedisClient } from 'ioredis'
import { afterAll, beforeAll, describe, vi } from 'vitest'
import type { RedisCacheClient } from '../redis-instance.js'
import { runAtomicCacheContract } from './redis-atomic-contract.js'

vi.mock('../../../lib/startup/env.js', () => ({
	default: { USE_MOCK_DATA: true },
}))

vi.mock('../../logging/WinstonLogger.js', () => ({
	logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}))

const { createAtomicRedisClient } = await import('../redis-instance.js')
const RedisConstructor = Redis as unknown as {
	new (url: string): RedisClient
}

const redisUrl = process.env.PLUTO_TEST_REDIS_URL
if (process.env.PLUTO_REQUIRE_REDIS_TESTS === '1' && !redisUrl) {
	throw new Error(
		'PLUTO_TEST_REDIS_URL is required when PLUTO_REQUIRE_REDIS_TESTS=1.',
	)
}
const describeWithRedis = redisUrl ? describe : describe.skip

describeWithRedis('real Redis atomic adapter', () => {
	let redis: RedisCacheClient

	beforeAll(() => {
		redis = createAtomicRedisClient(new RedisConstructor(redisUrl!))
	})

	afterAll(async () => {
		await redis.quit()
	})

	runAtomicCacheContract(
		'shared behavior',
		() => redis,
		`pluto:test:atomic:${process.pid}:${Date.now()}`,
	)
})
