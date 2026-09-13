import { beforeEach, describe, expect, it, vi } from 'vitest'

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
	registerShutdownQueue: vi.fn(),
}))

const { NotificationDeliveryQueue } = await import('../delivery-queue.js')

describe('notification delivery shutdown', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it('pauses the worker before closing its queue', async () => {
		const queue = new NotificationDeliveryQueue({
			queue: { add: vi.fn(), close: vi.fn(async () => undefined) },
			store: {} as never,
			dispatcher: {} as never,
		})

		await queue.close(1)

		expect(workerState.getWorker()?.pause).toHaveBeenCalledWith(true)
		expect(workerState.getWorker()?.close).toHaveBeenCalledWith(false)
	})
})
