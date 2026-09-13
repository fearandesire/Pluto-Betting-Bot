import Redis, { type Redis as RedisClient } from 'ioredis'
import {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from 'vitest'

const warn = vi.hoisted(() => vi.fn())

vi.mock('../../../logging/WinstonLogger.js', () => ({
	logger: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn },
}))

import { closeQueueWorkers } from '../../../../lib/startup/shutdown.js'
import { clearShutdownQueueRegistryForTests } from '../../../../lib/startup/shutdown-registry.js'
import {
	type ChannelIntent,
	type ChannelReservationStore,
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

	beforeEach(() => {
		vi.clearAllMocks()
	})

	beforeAll(() => {
		redis = new RedisConstructor(redisUrl!)
		storeRedis = reservationRedis(redis)
	})

	afterAll(async () => {
		await redis.quit()
	})

	afterEach(() => {
		vi.useRealTimers()
		clearShutdownQueueRegistryForTests()
	})

	it('stops renewing an owned lease after shutdown', async () => {
		vi.useFakeTimers()
		const intent = uniqueIntent('timer')
		const store = new RedisChannelReservationStore(storeRedis, {
			leaseSeconds: 300,
		})
		let resolveLookup!: (channel: { id: string } | null) => void
		const findByMarker = vi
			.fn()
			.mockImplementationOnce(
				() =>
					new Promise<{ id: string } | null>((resolve) => {
						resolveLookup = resolve
					}),
			)
			.mockResolvedValue(null)
		const injected = workflowPorts(store, { findByMarker })
		const workflow = new ChannelCreationWorkflow(injected)
		const refresh = vi.spyOn(storeRedis, 'refreshIfOwned')
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
		const reservations = reservationsWithRelease(store, release)
		const workflow = new ChannelCreationWorkflow(
			workflowPorts(reservations, {
				create: vi.fn().mockRejectedValue(new Error('create failed')),
			}),
		)

		await expect(workflow.run(intent)).rejects.toThrow(
			'transient release failure',
		)
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
			workflowPorts(reservationsWithRelease(store, release), {
				create: vi.fn().mockRejectedValue(new Error('create failed')),
			}),
		)
		const run = workflow.run(intent)
		await waitForReservation(redis, intent)
		await expect(run).rejects.toThrow('transient release failure')
		await redis.set(
			keyFor(intent),
			JSON.stringify({ state: 'reserved', owner: 'new-owner' }),
			'EX',
			300,
		)

		await closeQueueWorkers(30_000)

		expect(release).toHaveBeenCalledTimes(2)
		expect(await redis.get(keyFor(intent))).toBe(
			JSON.stringify({ state: 'reserved', owner: 'new-owner' }),
		)
		await redis.del(keyFor(intent))
	})

	it('logs and survives a shutdown release failure', async () => {
		vi.useFakeTimers()
		const intent = uniqueIntent('failure')
		const store = new RedisChannelReservationStore(storeRedis, {
			leaseSeconds: 300,
		})
		const findByMarker = vi.fn().mockResolvedValue(null)
		let rejectRelease!: (error: Error) => void
		const release = vi.fn(
			() =>
				new Promise<boolean>((_, reject) => {
					rejectRelease = reject
				}),
		)
		const workflow = new ChannelCreationWorkflow(
			workflowPorts(reservationsWithRelease(store, release), {
				findByMarker,
				create: vi.fn().mockRejectedValue(new Error('create failed')),
			}),
		)
		const run = workflow.run(intent)
		await waitForReservation(redis, intent)
		await vi.waitFor(() => expect(release).toHaveBeenCalledOnce())
		const close = closeQueueWorkers(30_000)

		await vi.advanceTimersByTimeAsync(1_500)
		await expect(close).resolves.not.toThrow()
		expect(release).toHaveBeenCalledOnce()

		expect(warn).toHaveBeenCalledWith({
			message: 'lease left to expire',
			channelKey: intent.marker,
		})

		rejectRelease(new Error('redis unavailable'))
		await expect(run).rejects.toThrow('redis unavailable')
		await redis.del(keyFor(intent))
	})

	it('bounds shutdown with an unresolved new channel completion', async () => {
		vi.useFakeTimers()
		const intent = uniqueIntent('unresolved-new-channel')
		const store = new RedisChannelReservationStore(storeRedis, {
			leaseSeconds: 300,
		})
		let resolveCompletion!: () => void
		const completion = new Promise<void>((resolve) => {
			resolveCompletion = resolve
		})
		let resolveCompleteEntered!: () => void
		const completeEntered = new Promise<void>((resolve) => {
			resolveCompleteEntered = resolve
		})
		const complete = vi.fn(() => {
			resolveCompleteEntered()
			return completion
		})
		const create = vi.fn().mockResolvedValue({
			channelId: 'discord-channel-new',
			complete,
		})
		const workflow = new ChannelCreationWorkflow(
			workflowPorts(store, { create }),
		)
		const refresh = vi.spyOn(storeRedis, 'refreshIfOwned')
		const run = workflow.run(intent)

		await vi.waitFor(() => expect(complete).toHaveBeenCalledOnce())
		await completeEntered
		const close = closeQueueWorkers(30_000)
		await vi.advanceTimersByTimeAsync(2_000)
		await expect(close).resolves.not.toThrow()
		const refreshCount = refresh.mock.calls.length
		await vi.advanceTimersByTimeAsync(60_000)
		expect(refresh).toHaveBeenCalledTimes(refreshCount)
		resolveCompletion()

		await expect(run).resolves.toEqual({
			state: 'created',
			channelId: 'discord-channel-new',
		})
		expect(warn).toHaveBeenCalledWith({
			message: 'in-flight creation exceeded shutdown budget',
			channelKey: intent.marker,
		})
		await redis.del(keyFor(intent))
	})

	it('bounds shutdown with an unresolved existing channel completion', async () => {
		vi.useFakeTimers()
		const intent = uniqueIntent('unresolved-existing-channel')
		const store = new RedisChannelReservationStore(storeRedis, {
			leaseSeconds: 300,
		})
		let resolveCompletion!: () => void
		const completion = new Promise<void>((resolve) => {
			resolveCompletion = resolve
		})
		let resolveCompleteEntered!: () => void
		const completeEntered = new Promise<void>((resolve) => {
			resolveCompleteEntered = resolve
		})
		const findByMarker = vi
			.fn()
			.mockResolvedValueOnce(null)
			.mockResolvedValue({ id: 'discord-channel-existing' })
		const completeExisting = vi.fn(() => {
			resolveCompleteEntered()
			return completion
		})
		const workflow = new ChannelCreationWorkflow(
			workflowPorts(store, {
				findByMarker,
				create: vi.fn().mockRejectedValue(new Error('create failed')),
				completeExisting,
			}),
		)
		const refresh = vi.spyOn(storeRedis, 'refreshIfOwned')
		const run = workflow.run(intent)

		await vi.waitFor(() => expect(completeExisting).toHaveBeenCalledOnce())
		await completeEntered
		const close = closeQueueWorkers(30_000)
		await vi.advanceTimersByTimeAsync(2_000)
		await expect(close).resolves.not.toThrow()
		const refreshCount = refresh.mock.calls.length
		await vi.advanceTimersByTimeAsync(60_000)
		expect(refresh).toHaveBeenCalledTimes(refreshCount)
		resolveCompletion()

		await expect(run).resolves.toEqual({
			state: 'reconciled',
			channelId: 'discord-channel-existing',
		})
		expect(warn).toHaveBeenCalledWith({
			message: 'in-flight creation exceeded shutdown budget',
			channelKey: intent.marker,
		})
		await redis.del(keyFor(intent))
	})

	it('logs when an in-flight creation settles within the shutdown sub-budget', async () => {
		vi.useFakeTimers()
		const intent = uniqueIntent('settled-in-flight')
		const store = new RedisChannelReservationStore(storeRedis, {
			leaseSeconds: 300,
		})
		let resolveCompletion!: () => void
		const completion = new Promise<void>((resolve) => {
			resolveCompletion = resolve
		})
		let resolveCompleteEntered!: () => void
		const completeEntered = new Promise<void>((resolve) => {
			resolveCompleteEntered = resolve
		})
		const complete = vi.fn(() => {
			resolveCompleteEntered()
			return completion
		})
		const workflow = new ChannelCreationWorkflow(
			workflowPorts(store, {
				create: vi.fn().mockResolvedValue({
					channelId: 'discord-channel-settled',
					complete,
				}),
			}),
		)
		const run = workflow.run(intent)

		await vi.waitFor(() => expect(complete).toHaveBeenCalledOnce())
		await completeEntered
		const close = closeQueueWorkers(30_000)
		setTimeout(resolveCompletion, 1_000)
		await vi.advanceTimersByTimeAsync(1_000)
		await expect(close).resolves.not.toThrow()
		await expect(run).resolves.toEqual({
			state: 'created',
			channelId: 'discord-channel-settled',
		})

		expect(warn).toHaveBeenCalledWith({
			message: 'waited for in-flight creation',
			channelKey: intent.marker,
		})
		expect(warn).not.toHaveBeenCalledWith({
			message: 'lease left to expire',
			channelKey: intent.marker,
		})
		await redis.del(keyFor(intent))
	})

	it('retries a settled failed run release within the shutdown budget', async () => {
		vi.useFakeTimers()
		const intent = uniqueIntent('release-retry-timeout')
		const store = new RedisChannelReservationStore(storeRedis, {
			leaseSeconds: 300,
		})
		const findByMarker = vi.fn().mockResolvedValue(null)
		let resolveRetry!: (released: boolean) => void
		let retryStarted!: () => void
		const retryEntered = new Promise<void>((resolve) => {
			retryStarted = resolve
		})
		const retry = new Promise<boolean>((resolve) => {
			resolveRetry = resolve
		})
		let retrySettled = false
		const release = vi.fn(() => {
			retryStarted()
			return retry.then((released) => {
				retrySettled = true
				return released
			})
		})
		release.mockRejectedValueOnce(new Error('initial release failed'))
		const workflow = new ChannelCreationWorkflow(
			workflowPorts(reservationsWithRelease(store, release), {
				findByMarker,
				create: vi.fn().mockRejectedValue(new Error('create failed')),
			}),
		)
		const run = workflow.run(intent)
		await waitForReservation(redis, intent)
		await expect(run).rejects.toThrow('initial release failed')
		const close = closeQueueWorkers(30_000)

		await retryEntered
		expect(release).toHaveBeenCalledTimes(2)
		await vi.advanceTimersByTimeAsync(2_000)
		await expect(close).resolves.not.toThrow()
		expect(release).toHaveBeenCalledTimes(2)
		expect(warn).toHaveBeenCalledWith({
			message: 'lease left to expire',
			channelKey: intent.marker,
		})

		resolveRetry(true)
		await retry
		await vi.waitFor(() => expect(retrySettled).toBe(true))
		await redis.del(keyFor(intent))
	})

	it('retains a renewed lease for shutdown cleanup after the original expiry', async () => {
		vi.useFakeTimers()
		const intent = uniqueIntent('renewed-lease-retention')
		const store = new RedisChannelReservationStore(storeRedis, {
			leaseSeconds: 300,
		})
		const findByMarker = vi.fn().mockResolvedValue(null)
		let rejectCreate!: (error: Error) => void
		const create = vi.fn(
			() =>
				new Promise<{
					channelId: string
					complete: () => Promise<void>
				}>((_, reject) => {
					rejectCreate = reject
				}),
		)
		let resolveRetry!: (released: boolean) => void
		let retryStarted!: () => void
		const retryEntered = new Promise<void>((resolve) => {
			retryStarted = resolve
		})
		const retry = new Promise<boolean>((resolve) => {
			resolveRetry = resolve
		})
		const release = vi
			.fn()
			.mockRejectedValueOnce(new Error('initial release failed'))
			.mockImplementationOnce(() => {
				retryStarted()
				return retry
			})
		const workflow = new ChannelCreationWorkflow(
			workflowPorts(reservationsWithRelease(store, release), {
				findByMarker,
				create,
			}),
		)
		const refresh = vi.spyOn(storeRedis, 'refreshIfOwned')
		const run = workflow.run(intent)

		await waitForReservation(redis, intent)
		await vi.waitFor(() => expect(refresh).toHaveBeenCalledOnce())
		await vi.advanceTimersByTimeAsync(4 * 60 * 1_000)
		await vi.waitFor(() =>
			expect(refresh.mock.calls.length).toBeGreaterThanOrEqual(5),
		)

		rejectCreate(new Error('create failed'))
		await expect(run).rejects.toThrow('initial release failed')
		await vi.advanceTimersByTimeAsync(2 * 60 * 1_000)
		expect(await redis.exists(keyFor(intent))).toBe(1)

		const close = closeQueueWorkers(30_000)
		await retryEntered
		expect(release).toHaveBeenCalledTimes(2)
		await vi.advanceTimersByTimeAsync(2_000)
		await expect(close).resolves.not.toThrow()
		expect(warn).toHaveBeenCalledWith({
			message: 'lease left to expire',
			channelKey: intent.marker,
		})

		resolveRetry(true)
		await retry
		await redis.del(keyFor(intent))
	})

	it('drops a failed lease registry entry after the lease TTL', async () => {
		vi.useFakeTimers()
		const intent = uniqueIntent('registry-expiry')
		const store = new RedisChannelReservationStore(storeRedis, {
			leaseSeconds: 300,
		})
		const release = vi
			.fn()
			.mockRejectedValue(new Error('redis unavailable'))
		const workflow = new ChannelCreationWorkflow(
			workflowPorts(reservationsWithRelease(store, release), {
				create: vi.fn().mockRejectedValue(new Error('create failed')),
			}),
		)

		await expect(workflow.run(intent)).rejects.toThrow('redis unavailable')
		const close = vi.spyOn(workflow, 'close')
		await vi.advanceTimersByTimeAsync(5 * 60 * 1000)
		await closeQueueWorkers(30_000)

		expect(close).not.toHaveBeenCalled()
		await redis.del(keyFor(intent))
	})
})

function workflowPorts(
	store: ChannelReservationStore,
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

function reservationsWithRelease(
	store: RedisChannelReservationStore,
	release: ChannelReservationStore['release'],
): ChannelReservationStore {
	return {
		reserve: store.reserve.bind(store),
		refresh: store.refresh.bind(store),
		reclaimCreated: store.reclaimCreated.bind(store),
		recordCreated: store.recordCreated.bind(store),
		release,
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
	const set = redis.set.bind(redis) as unknown as ReservationRedis['set']
	return {
		get: (key) => redis.get(key),
		set: (key, value, ...options) => set(key, value, ...options),
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
