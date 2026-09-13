import Redis, { type Redis as RedisClient } from 'ioredis'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

const warn = vi.hoisted(() => vi.fn())

vi.mock('../../../logging/WinstonLogger.js', () => ({
	logger: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn },
}))

import { closeQueueWorkers } from '../../../../lib/startup/shutdown.js'
import {
	type ChannelIntent,
	RedisChannelReservationStore,
} from '../../../cache/queue/channel-reservation-store.js'
import {
	type ChannelCreationPorts,
	ChannelCreationWorkflow,
} from '../ChannelCreationWorkflow.js'

const redisUrl = process.env.PLUTO_TEST_REDIS_URL
if (process.env.PLUTO_REQUIRE_REDIS_TESTS === '1' && !redisUrl) {
	throw new Error(
		'PLUTO_TEST_REDIS_URL is required when PLUTO_REQUIRE_REDIS_TESTS=1.',
	)
}

const describeWithRedis = redisUrl ? describe : describe.skip
const RedisConstructor = Redis as unknown as {
	new (url: string): RedisClient
}

describeWithRedis('channel creation lease shutdown', () => {
	let redis: RedisClient
	let storeRedis: ReservationRedis

	beforeAll(() => {
		redis = new RedisConstructor(redisUrl!)
		storeRedis = reservationRedis(redis)
	})

	afterAll(async () => {
		await redis.quit()
	})

	it('stops renewing an owned lease after shutdown', async () => {
		vi.useFakeTimers()
		const intent = uniqueIntent('timer')
		const store = new RedisChannelReservationStore(storeRedis, {
			leaseSeconds: 300,
		})
		let resolveLookup!: (channel: { id: string } | null) => void
		const findByMarker = vi.fn(
			() =>
				new Promise<{ id: string } | null>((resolve) => {
					resolveLookup = resolve
				}),
		)
		const injected = workflowPorts(store, { findByMarker })
		const workflow = new ChannelCreationWorkflow(injected)
		const refresh = vi.spyOn(redis, 'refreshIfOwned')
		const run = workflow.run(intent)

		await waitForReservation(redis, intent)
		await vi.advanceTimersByTimeAsync(60_000)
		await vi.waitFor(() => expect(refresh).toHaveBeenCalledOnce())

		const shutdown = closeQueueWorkers(30_000)
		await vi.advanceTimersByTimeAsync(2_000)
		await shutdown
		const refreshCount = refresh.mock.calls.length

		await vi.advanceTimersByTimeAsync(60_000)
		expect(refresh).toHaveBeenCalledTimes(refreshCount)

		resolveLookup(null)
		await run
		await redis.del(keyFor(intent))
	})

	it('releases an owned lease so an immediate retry can reserve it', async () => {
		const intent = uniqueIntent('release')
		const store = new RedisChannelReservationStore(storeRedis, {
			leaseSeconds: 300,
		})
		const release = vi
			.fn()
			.mockRejectedValueOnce(new Error('transient release failure'))
			.mockImplementation((releaseIntent: ChannelIntent, owner: string) =>
				store.release(releaseIntent, owner),
			)
		const reservations = { ...store, release }
		const workflow = new ChannelCreationWorkflow(
			workflowPorts(reservations, {
				create: vi.fn().mockRejectedValue(new Error('create failed')),
			}),
		)

		await expect(workflow.run(intent)).rejects.toThrow('create failed')
		await closeQueueWorkers(30_000)

		expect(await store.reserve(intent, 'retry-owner')).toEqual({
			state: 'acquired',
			owner: 'retry-owner',
		})
		await redis.del(keyFor(intent))
	})

	it('does not delete a lease taken over by another owner', async () => {
		const intent = uniqueIntent('takeover')
		const store = new RedisChannelReservationStore(storeRedis, {
			leaseSeconds: 300,
		})
		const release = vi
			.fn()
			.mockRejectedValueOnce(new Error('transient release failure'))
			.mockImplementation((releaseIntent: ChannelIntent, owner: string) =>
				store.release(releaseIntent, owner),
			)
		const workflow = new ChannelCreationWorkflow(
			workflowPorts(
				{ ...store, release },
				{
					create: vi
						.fn()
						.mockRejectedValue(new Error('create failed')),
				},
			),
		)
		const run = workflow.run(intent)
		await waitForReservation(redis, intent)
		await redis.set(
			keyFor(intent),
			JSON.stringify({ state: 'reserved', owner: 'new-owner' }),
			'EX',
			300,
		)

		await expect(run).rejects.toThrow('create failed')
		await closeQueueWorkers(30_000)

		expect(release).toHaveBeenCalledTimes(2)
		expect(await redis.get(keyFor(intent))).toBe(
			JSON.stringify({ state: 'reserved', owner: 'new-owner' }),
		)
		await redis.del(keyFor(intent))
	})

	it('logs and survives a shutdown release failure', async () => {
		const intent = uniqueIntent('failure')
		const store = new RedisChannelReservationStore(storeRedis, {
			leaseSeconds: 300,
		})
		const release = vi
			.fn()
			.mockRejectedValue(new Error('redis unavailable'))
		const workflow = new ChannelCreationWorkflow(
			workflowPorts(
				{ ...store, release },
				{
					create: vi
						.fn()
						.mockRejectedValue(new Error('create failed')),
				},
			),
		)

		await expect(workflow.run(intent)).rejects.toThrow('redis unavailable')
		await expect(closeQueueWorkers(30_000)).resolves.not.toThrow()

		expect(warn).toHaveBeenCalledWith({
			message: 'lease left to expire',
			channelKey: intent.marker,
		})
		await redis.del(keyFor(intent))
	})
})

function workflowPorts(
	store:
		| RedisChannelReservationStore
		| (RedisChannelReservationStore & {
				release: ReturnType<typeof vi.fn>
		  }),
	overrides: Partial<ChannelCreationPorts['discord']> = {},
): ChannelCreationPorts {
	return {
		reservations: store,
		discord: {
			findByMarker: vi.fn().mockResolvedValue(null),
			create: vi.fn().mockResolvedValue({
				channelId: 'discord-channel-1',
				complete: vi.fn().mockResolvedValue(undefined),
			}),
			...overrides,
		},
	}
}

function uniqueIntent(label: string): ChannelIntent {
	const id = `${process.pid}-${Date.now()}-${label}`
	return {
		guildId: 'shutdown-test-guild',
		gameId: id,
		channelName: 'shutdown-test-channel',
		marker: `pluto-test-channel:${id}`,
	}
}

function keyFor(intent: ChannelIntent): string {
	return `pluto:channel-reservation:v1:${encodeURIComponent(intent.guildId)}:${encodeURIComponent(intent.gameId)}`
}

async function waitForReservation(
	redis: RedisClient,
	intent: ChannelIntent,
): Promise<void> {
	for (let attempt = 0; attempt < 50; attempt++) {
		if (await redis.exists(keyFor(intent))) return
	}
	throw new Error('reservation was not acquired')
}

interface ReservationRedis {
	get(key: string): Promise<string | null>
	set(
		key: string,
		value: string,
		...options: Array<string | number>
	): Promise<'OK' | null>
	compareAndRemove(key: string, expectedValue: string): Promise<boolean>
	transitionIfValue(
		key: string,
		expectedValue: string,
		nextValue: string,
		seconds?: number,
	): Promise<boolean>
	refreshIfOwned(
		key: string,
		expectedValue: string,
		seconds: number,
	): Promise<boolean>
}

function reservationRedis(redis: RedisClient): ReservationRedis {
	return {
		get: (key) => redis.get(key),
		set: (key, value, ...options) =>
			redis.set(key, value, ...options) as Promise<'OK' | null>,
		compareAndRemove: async (key, expectedValue) =>
			Number(
				await redis.eval(
					`if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) end return 0`,
					1,
					key,
					expectedValue,
				),
			) === 1,
		transitionIfValue: async (key, expectedValue, nextValue, seconds) =>
			Number(
				await redis.eval(
					`if redis.call('get', KEYS[1]) ~= ARGV[1] then return 0 end if ARGV[3] == '' then redis.call('set', KEYS[1], ARGV[2], 'KEEPTTL') else redis.call('set', KEYS[1], ARGV[2], 'EX', ARGV[3]) end return 1`,
					1,
					key,
					expectedValue,
					nextValue,
					seconds ?? '',
				),
			) === 1,
		refreshIfOwned: async (key, expectedValue, seconds) =>
			Number(
				await redis.eval(
					`if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('expire', KEYS[1], ARGV[2]) end return 0`,
					1,
					key,
					expectedValue,
					seconds,
				),
			) === 1,
	}
}
