import { beforeEach, describe, expect, it, vi } from 'vitest'

const closeChannelCreationQueue = vi.fn(async () => undefined)
const closeChannelDeletionQueue = vi.fn(async () => undefined)
const closeMatchRefreshQueue = vi.fn(async () => undefined)

vi.mock('../../../utils/cache/queue/ChannelCreationQueue.js', () => ({
	channelCreationQueue: { close: closeChannelCreationQueue },
}))

vi.mock('../../../utils/cache/queue/ChannelDeletionQueue.js', () => ({
	channelDeletionQueue: { close: closeChannelDeletionQueue },
}))

vi.mock('../../../utils/cache/queue/match-refresh-queue.js', () => ({
	getMatchRefreshQueue: () => ({ close: closeMatchRefreshQueue }),
}))

vi.mock('../../../utils/logging/WinstonLogger.js', () => ({
	logger: { info: vi.fn(), error: vi.fn() },
}))

const { closeQueueWorkers, installShutdownHandlers } = await import(
	'../shutdown.js'
)

describe('Pluto graceful shutdown', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it('closes every queue worker with the shutdown bound', async () => {
		await closeQueueWorkers()

		expect(closeChannelCreationQueue).toHaveBeenCalledWith(30_000)
		expect(closeChannelDeletionQueue).toHaveBeenCalledWith(30_000)
		expect(closeMatchRefreshQueue).toHaveBeenCalledWith(30_000)
	})

	it('drains once when SIGTERM and SIGINT arrive together', async () => {
		const handlers = new Map<string, () => void>()
		const processLike = {
			once: vi.fn((signal: string, handler: () => void) => {
				handlers.set(signal, handler)
			}),
			removeListener: vi.fn(),
		}
		const client = { destroy: vi.fn() }
		const exitProcess = vi.fn()

		installShutdownHandlers({
			client,
			processLike,
			exitProcess,
		})

		handlers.get('SIGTERM')?.()
		handlers.get('SIGINT')?.()
		await vi.waitFor(() => expect(exitProcess).toHaveBeenCalledWith(0))

		expect(client.destroy).toHaveBeenCalledOnce()
		expect(closeChannelCreationQueue).toHaveBeenCalledOnce()
		expect(closeChannelDeletionQueue).toHaveBeenCalledOnce()
		expect(closeMatchRefreshQueue).toHaveBeenCalledOnce()
	})
})
