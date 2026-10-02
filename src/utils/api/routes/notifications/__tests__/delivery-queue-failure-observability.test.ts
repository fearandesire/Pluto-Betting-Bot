import { beforeEach, describe, expect, it, vi } from 'vitest'

const logger = vi.hoisted(() => ({
	error: vi.fn(),
	warn: vi.fn(),
	info: vi.fn(),
}))

vi.mock('../../../../logging/WinstonLogger.js', () => ({ logger }))

const { deliveryEnvelopeSchema } = await import('../delivery-contract.js')
const { NotificationDeliveryQueue } = await import('../delivery-queue.js')
const { RedisDeliveryStore } = await import('../delivery-store.js')

import type { Job } from 'bullmq'
import type { DeliveryEnvelope } from '../delivery-contract.js'
import type {
	DeliveryDispatcher,
	DeliveryQueuePort,
} from '../delivery-queue.js'
import type { DeliveryStore } from '../delivery-store.js'

const envelope = deliveryEnvelopeSchema.parse({
	delivery_id: '550e8400-e29b-41d4-a716-446655440111',
	schema_version: 1,
	kind: 'prop_settled',
	occurred_at: '2026-07-14T20:00:00.000Z',
	payload: {
		outcome_uuid: '550e8400-e29b-41d4-a716-446655440112',
		result: 'won',
		market_key: 'player_points',
		description: 'Player',
		tallies: { correct: 1, incorrect: 0, total: 1 },
		messages: [
			{
				guild_id: 'guild-1',
				channel_id: 'channel-1',
				message_id: 'message-1',
			},
		],
	},
})

function fakeRedis() {
	const values = new Map<string, string>()
	return {
		set: async (
			key: string,
			value: string,
			...args: Array<string | number>
		) => {
			if (args.includes('NX') && values.has(key)) return null
			values.set(key, value)
			return 'OK' as const
		},
		get: async (key: string) => values.get(key) ?? null,
	} as never
}

function jobFor(
	data: DeliveryEnvelope,
	attemptsMade: number,
	attempts = 8,
): Job<DeliveryEnvelope> {
	return { data, attemptsMade, opts: { attempts } } as never
}

function buildQueue(
	options: {
		store?: DeliveryStore
		dispatcher?: DeliveryDispatcher
		reporter?: {
			firing: ReturnType<typeof vi.fn>
			resolved: ReturnType<typeof vi.fn>
		}
	} = {},
) {
	const reporter = options.reporter ?? {
		firing: vi.fn().mockResolvedValue(undefined),
		resolved: vi.fn().mockResolvedValue(undefined),
	}
	const dispatcher: DeliveryDispatcher = options.dispatcher ?? {
		deliver: vi.fn().mockResolvedValue({ message_id: 'message-1' }),
	}
	const queue = new NotificationDeliveryQueue({
		store: options.store ?? new RedisDeliveryStore(fakeRedis()),
		dispatcher,
		alertReporter: reporter as never,
		queue: {
			add: vi.fn(async () => undefined),
			close: vi.fn(async () => undefined),
		} satisfies DeliveryQueuePort,
		startWorker: false,
	})
	return { queue, reporter, dispatcher }
}

const loggedEvents = (level: 'error' | 'warn') =>
	logger[level].mock.calls.map(([entry]) => entry.event)

describe('notification delivery failure observability', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it('logs the exhausted event and raises delivery.failed when the last attempt fails', async () => {
		const { queue, reporter } = buildQueue()

		await queue.handleJobFailed(
			jobFor(envelope, 8),
			new Error('Redis connection lost'),
		)

		expect(loggedEvents('error')).toEqual([
			'notification.delivery.job_failed',
			'notification.delivery.exhausted',
		])
		expect(logger.error).toHaveBeenLastCalledWith(
			expect.objectContaining({
				delivery_id: envelope.delivery_id,
				kind: 'prop_settled',
				attempts_made: 8,
				max_attempts: 8,
				error: 'Redis connection lost',
			}),
		)
		expect(reporter.firing).toHaveBeenCalledOnce()
		expect(reporter.firing).toHaveBeenCalledWith(
			expect.objectContaining({
				key: 'delivery.failed',
				scope: `prop_settled:${envelope.delivery_id}`,
			}),
		)
		await queue.close()
	})

	it('only logs the attempt when retries remain', async () => {
		const { queue, reporter } = buildQueue()

		await queue.handleJobFailed(jobFor(envelope, 3), new Error('boom'))

		expect(loggedEvents('error')).toEqual([
			'notification.delivery.job_failed',
		])
		expect(reporter.firing).not.toHaveBeenCalled()
		await queue.close()
	})

	it('alerts when processing itself throws on the final attempt', async () => {
		const real = new RedisDeliveryStore(fakeRedis())
		const store: DeliveryStore = {
			accept: (value) => real.accept(value),
			get: (id) => real.get(id),
			update: async () => {
				throw new Error('Redis unavailable')
			},
		}
		const { queue, reporter } = buildQueue({ store })
		await queue.accept(envelope)

		const job = jobFor(envelope, 7)
		const failure = await queue.processJob(job).then(
			() => undefined,
			(error: Error) => error,
		)

		// process() blew up before it could classify or alert on anything.
		expect(failure?.message).toBe('Redis unavailable')
		expect(reporter.firing).not.toHaveBeenCalled()

		// BullMQ then reports the final failed attempt to the worker listener.
		await queue.handleJobFailed(
			jobFor(envelope, 8),
			failure ?? new Error('missing'),
		)

		expect(reporter.firing).toHaveBeenCalledOnce()
		expect(loggedEvents('error')).toContain(
			'notification.delivery.exhausted',
		)
		await queue.close()
	})

	it('logs instead of silently dropping a failed alert report', async () => {
		const reporter = {
			firing: vi.fn().mockRejectedValue(new Error('alert store down')),
			resolved: vi.fn().mockResolvedValue(undefined),
		}
		const { queue } = buildQueue({
			reporter,
			dispatcher: {
				deliver: vi.fn().mockRejectedValue(
					Object.assign(new Error('bad request'), {
						status: 400,
					}),
				),
			},
		})
		await queue.accept(envelope)

		await queue.processJob(jobFor(envelope, 7))

		expect(logger.error).toHaveBeenCalledWith(
			expect.objectContaining({
				event: 'notification.delivery.alert_report_failed',
				transition: 'firing',
				delivery_id: envelope.delivery_id,
				error: 'alert store down',
			}),
		)
		await queue.close()
	})

	it('reports a queued job whose delivery record no longer exists', async () => {
		const { queue, reporter, dispatcher } = buildQueue()

		await queue.processJob(jobFor(envelope, 0))

		expect(dispatcher.deliver).not.toHaveBeenCalled()
		expect(logger.error).toHaveBeenCalledWith(
			expect.objectContaining({
				event: 'notification.delivery.record_missing',
				delivery_id: envelope.delivery_id,
				kind: 'prop_settled',
			}),
		)
		expect(reporter.firing).toHaveBeenCalledWith(
			expect.objectContaining({
				key: 'delivery.failed',
				scope: `prop_settled:${envelope.delivery_id}`,
			}),
		)
		await queue.close()
	})
})
