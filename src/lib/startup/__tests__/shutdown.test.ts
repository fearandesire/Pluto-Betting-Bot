import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const events: string[] = []
const closeChannelCreationQueue = vi.fn(async () => undefined)
const closeChannelDeletionQueue = vi.fn(async () => undefined)
const closeMatchRefreshQueue = vi.fn(async () => undefined)
const queueModuleImports = vi.hoisted(() => ({
	creation: vi.fn(),
	deletion: vi.fn(),
	matchRefresh: vi.fn(),
}))

vi.mock('../../../utils/cache/queue/ChannelCreationQueue.js', () => {
	queueModuleImports.creation()
	return {
		channelCreationQueue: { close: closeChannelCreationQueue },
	}
})

vi.mock('../../../utils/cache/queue/ChannelDeletionQueue.js', () => {
	queueModuleImports.deletion()
	return {
		channelDeletionQueue: { close: closeChannelDeletionQueue },
	}
})

vi.mock('../../../utils/cache/queue/match-refresh-queue.js', () => {
	queueModuleImports.matchRefresh()
	return {
		getMatchRefreshQueue: () => ({ close: closeMatchRefreshQueue }),
	}
})

vi.mock('../../../utils/logging/WinstonLogger.js', () => ({
	logger: {
		info: vi.fn(),
		error: vi.fn(),
		warn: vi.fn(),
	},
}))

const { closeQueueWorkers, installShutdownHandlers } = await import(
	'../shutdown.js'
)
const { registerShutdownQueue } = await import('../shutdown.js')

describe('Pluto graceful shutdown', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		events.length = 0
		registerShutdownQueue('channel-creation', {
			close: closeChannelCreationQueue,
		})
		registerShutdownQueue('channel-deletion', {
			close: closeChannelDeletionQueue,
		})
		registerShutdownQueue('match-refresh', {
			close: closeMatchRefreshQueue,
		})
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	it('closes every queue worker with the shutdown bound', async () => {
		await closeQueueWorkers()

		expect(queueModuleImports.creation).not.toHaveBeenCalled()
		expect(queueModuleImports.deletion).not.toHaveBeenCalled()
		expect(queueModuleImports.matchRefresh).not.toHaveBeenCalled()
		expect(closeChannelCreationQueue).toHaveBeenCalledWith(30_000)
		expect(closeChannelDeletionQueue).toHaveBeenCalledWith(30_000)
		expect(closeMatchRefreshQueue).toHaveBeenCalledWith(30_000)
	})

	it('drains once when SIGTERM and SIGINT arrive together', async () => {
		const handlers = new Map<string, () => void>()
		const processLike = {
			on: vi.fn((signal: string, handler: () => void) => {
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

	it('destroys the client only after every queue has closed', async () => {
		let resolveChannelCreation!: () => void
		const channelCreationClosed = new Promise<void>((resolve) => {
			resolveChannelCreation = resolve
		})
		closeChannelCreationQueue.mockImplementationOnce(async () => {
			await channelCreationClosed
			events.push('channel creation closed')
		})
		closeChannelDeletionQueue.mockImplementationOnce(async () => {
			events.push('channel deletion closed')
		})
		closeMatchRefreshQueue.mockImplementationOnce(async () => {
			events.push('match refresh closed')
		})
		const client = { destroy: vi.fn(() => events.push('client destroyed')) }
		const exitProcess = vi.fn(() => events.push('process exited'))
		const handlers = new Map<string, () => void>()

		installShutdownHandlers({
			client,
			processLike: {
				on: vi.fn((signal: string, handler: () => void) => {
					handlers.set(signal, handler)
				}),
				removeListener: vi.fn(),
			},
			exitProcess,
		})

		handlers.get('SIGTERM')?.()
		await Promise.resolve()
		expect(client.destroy).not.toHaveBeenCalled()

		resolveChannelCreation()
		await vi.waitFor(() => expect(exitProcess).toHaveBeenCalledWith(0))

		const destroyedAt = events.indexOf('client destroyed')
		expect(destroyedAt).toBeGreaterThan(
			events.indexOf('channel creation closed'),
		)
		expect(destroyedAt).toBeGreaterThan(
			events.indexOf('channel deletion closed'),
		)
		expect(destroyedAt).toBeGreaterThan(
			events.indexOf('match refresh closed'),
		)
		expect(events[events.length - 1]).toBe('process exited')
	})

	it('exits non-zero when queue shutdown fails', async () => {
		const client = { destroy: vi.fn() }
		const exitProcess = vi.fn()
		const closeQueues = vi.fn(async () => {
			throw new Error('Redis unavailable')
		})
		const handlers = new Map<string, () => void>()

		installShutdownHandlers({
			client,
			closeQueues,
			processLike: {
				on: vi.fn((signal: string, handler: () => void) => {
					handlers.set(signal, handler)
				}),
				removeListener: vi.fn(),
			},
			exitProcess,
		})

		handlers.get('SIGTERM')?.()
		await vi.waitFor(() => expect(exitProcess).toHaveBeenCalledWith(1))
	})

	it('exits non-zero when a queue is force-closed', async () => {
		const client = { destroy: vi.fn() }
		const exitProcess = vi.fn()
		const closeQueues = vi.fn(async () => true)
		const handlers = new Map<string, () => void>()

		installShutdownHandlers({
			client,
			closeQueues,
			processLike: {
				on: vi.fn((signal: string, handler: () => void) => {
					handlers.set(signal, handler)
				}),
				removeListener: vi.fn(),
			},
			exitProcess,
		})

		handlers.get('SIGTERM')?.()
		await vi.waitFor(() => expect(exitProcess).toHaveBeenCalledWith(1))
		expect(client.destroy).toHaveBeenCalledOnce()
	})

	it('arms a hard deadline when queue shutdown hangs', async () => {
		vi.useFakeTimers()
		const client = { destroy: vi.fn() }
		const exitProcess = vi.fn()
		const closeQueues = vi.fn(() => new Promise<void>(() => undefined))
		const handlers = new Map<string, () => void>()

		installShutdownHandlers({
			client,
			closeQueues,
			queueShutdownTimeoutMs: 10,
			processLike: {
				on: vi.fn((signal: string, handler: () => void) => {
					handlers.set(signal, handler)
				}),
				removeListener: vi.fn(),
			},
			exitProcess,
		})

		handlers.get('SIGTERM')?.()
		await vi.advanceTimersByTimeAsync(5_010)

		expect(exitProcess).toHaveBeenCalledWith(1)
	})
})
