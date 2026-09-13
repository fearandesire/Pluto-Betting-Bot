import { describe, expect, it, vi } from 'vitest'

const queueWorker = vi.hoisted(() => {
	let processor: ((job: never) => Promise<unknown>) | undefined
	let worker: FakeWorker | undefined

	class FakeQueue {
		add = vi.fn(async () => undefined)
		close = vi.fn(async () => undefined)
	}

	class FakeWorker {
		pause = vi.fn(async () => undefined)
		close = vi.fn(async () => undefined)

		constructor(
			_name: string,
			jobProcessor: (job: never) => Promise<unknown>,
		) {
			processor = jobProcessor
			worker = this
		}

		on() {
			return this
		}
	}

	return {
		FakeQueue,
		FakeWorker,
		getProcessor: () => processor,
		getWorker: () => worker,
	}
})

vi.mock('bullmq', () => ({
	Queue: queueWorker.FakeQueue,
	Worker: queueWorker.FakeWorker,
}))

vi.mock('../../../api/Khronos/matches/matchApiWrapper.js', () => ({
	default: class {
		getAllMatches = vi.fn()
	},
}))

vi.mock('../../cache-manager.js', () => ({
	CacheManager: class {
		set = vi.fn(async () => undefined)
	},
}))

vi.mock('../../data/config.js', () => ({
	REDIS_CONFIG: {},
}))

vi.mock('../../../logging/WinstonLogger.js', () => ({
	logger: {
		info: vi.fn(),
		error: vi.fn(),
		warn: vi.fn(),
		debug: vi.fn(),
	},
}))

const { MatchRefreshQueue } = await import('../match-refresh-queue.js')

describe('queue shutdown', () => {
	it('force-closes after an in-flight job exceeds the drain bound', async () => {
		let releaseJob!: () => void
		const jobFinished = new Promise<void>((resolve) => {
			releaseJob = resolve
		})
		const api = new (
			await import('../../../api/Khronos/matches/matchApiWrapper.js')
		).default()
		vi.mocked(api.getAllMatches).mockImplementationOnce(async () => {
			await jobFinished
			return { matches: [] }
		})

		const queue = new MatchRefreshQueue()
		const processor = queueWorker.getProcessor()
		const activeJob = processor?.({
			data: { reason: 'shutdown-test' },
		} as never)

		const closeError = await queue.close(1).then(
			() => undefined,
			(error: unknown) => error,
		)

		releaseJob()
		await expect(activeJob).rejects.toThrow('No matches returned from API')

		expect(queueWorker.getWorker()?.pause).toHaveBeenCalledWith(true)
		expect(queueWorker.getWorker()?.close).toHaveBeenCalledWith(true)
		expect(closeError).toBeUndefined()
	})
})
