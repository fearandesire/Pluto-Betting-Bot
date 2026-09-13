import { beforeEach, describe, expect, it, vi } from 'vitest'

const registerShutdownQueue = vi.hoisted(() => vi.fn())

const workerState = vi.hoisted(() => {
	let processor: ((job: never) => Promise<void>) | undefined
	let worker: FakeWorker | undefined

	class FakeWorker {
		pause = vi.fn(async () => undefined)
		close = vi.fn(async () => undefined)

		constructor(
			_name: string,
			jobProcessor: (job: never) => Promise<void>,
		) {
			processor = jobProcessor
			worker = this
		}

		on() {
			return this
		}
	}

	class FakeQueue {
		close = vi.fn(async () => undefined)
	}

	return {
		FakeQueue,
		FakeWorker,
		getProcessor: () => processor,
		getWorker: () => worker,
	}
})

vi.mock('bullmq', () => ({
	Queue: workerState.FakeQueue,
	Worker: workerState.FakeWorker,
}))

vi.mock('../delivery-store.js', () => ({
	RedisDeliveryStore: class {},
	deriveDeliveryState: vi.fn(),
}))

vi.mock('../../../../services/alerts/alert-reporter.js', () => ({
	getDefaultAlertReporter: () => undefined,
}))

vi.mock('../../../../services/alerts/failure-trackers.js', () => ({
	ConsecutiveFailureTracker: class {},
}))

vi.mock('../../../../logging/WinstonLogger.js', () => ({
	logger: { error: vi.fn() },
}))

vi.mock('../../../../../lib/startup/shutdown.js', () => ({
	registerShutdownQueue,
}))

const { NotificationDeliveryQueue } = await import('../delivery-queue.js')

describe('notification delivery shutdown', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it('pauses and drains the worker before closing its queue', async () => {
		let resolveDelivery!: () => void
		const deliveryFinished = new Promise<void>((resolve) => {
			resolveDelivery = resolve
		})
		const record = {
			delivery_id: 'delivery-1',
			schema_version: 1,
			kind: 'h2h_result',
			occurred_at: '2026-01-01T00:00:00.000Z',
			payload: {},
			state: 'queued',
			attempts: 0,
			destinations: [{ id: 'destination-1', state: 'queued' }],
		}
		const store = {
			get: vi.fn(async () => record),
			update: vi.fn(async (_deliveryId, update) => update(record)),
		}
		const dispatcher = {
			deliver: vi.fn(async () => {
				await deliveryFinished
				return { ok: true }
			}),
		}
		const queue = new NotificationDeliveryQueue({
			queue: { add: vi.fn(), close: vi.fn(async () => undefined) },
			store: store as never,
			dispatcher: dispatcher as never,
		})
		expect(registerShutdownQueue).toHaveBeenCalledWith(
			'notification-delivery-v1',
			queue,
		)
		const processor = workerState.getProcessor()
		const activeJob = processor?.({
			data: { delivery_id: 'delivery-1', kind: 'h2h_result' },
			attemptsMade: 0,
			opts: { attempts: 1 },
		} as never)

		await Promise.resolve()
		const closePromise = queue.close(1)
		await Promise.resolve()

		expect(workerState.getWorker()?.pause).toHaveBeenCalledWith(true)
		expect(workerState.getWorker()?.close).not.toHaveBeenCalled()

		resolveDelivery()
		await activeJob
		await closePromise
		expect(workerState.getWorker()?.close).toHaveBeenCalledWith(false)
	})
})
