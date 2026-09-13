import { logger } from '../../utils/logging/WinstonLogger.js'

export const QUEUE_SHUTDOWN_TIMEOUT_MS = 30_000

type ShutdownSignal = 'SIGTERM' | 'SIGINT'

interface ShutdownClient {
	destroy(): void
}

interface ShutdownProcess {
	once(signal: ShutdownSignal, listener: () => void): unknown
	removeListener(signal: ShutdownSignal, listener: () => void): unknown
}

export interface InstallShutdownHandlersOptions {
	client: ShutdownClient
	processLike?: ShutdownProcess
	closeQueues?: (timeoutMs: number) => Promise<void>
	exitProcess?: (code: number) => never | void
	queueShutdownTimeoutMs?: number
}

export async function closeQueueWorkers(
	timeoutMs = QUEUE_SHUTDOWN_TIMEOUT_MS,
): Promise<void> {
	const [
		{ channelCreationQueue },
		{ channelDeletionQueue },
		{ getMatchRefreshQueue },
	] = await Promise.all([
		import('../../utils/cache/queue/ChannelCreationQueue.js'),
		import('../../utils/cache/queue/ChannelDeletionQueue.js'),
		import('../../utils/cache/queue/match-refresh-queue.js'),
	])

	await Promise.all([
		channelCreationQueue.close(timeoutMs),
		channelDeletionQueue.close(timeoutMs),
		getMatchRefreshQueue().close(timeoutMs),
	])
}

export function installShutdownHandlers({
	client,
	processLike = process,
	closeQueues = closeQueueWorkers,
	exitProcess = process.exit,
	queueShutdownTimeoutMs = QUEUE_SHUTDOWN_TIMEOUT_MS,
}: InstallShutdownHandlersOptions): () => void {
	let shutdownPromise: Promise<void> | undefined

	const shutdown = (signal: ShutdownSignal): Promise<void> => {
		if (!shutdownPromise) {
			shutdownPromise = (async () => {
				logger.info({
					message: `Received ${signal}; shutting down Pluto`,
					source: 'startup:shutdown',
				})

				try {
					client.destroy()
					await closeQueues(queueShutdownTimeoutMs)
				} catch (error) {
					logger.error({
						message: 'Graceful shutdown failed',
						source: 'startup:shutdown',
						data: {
							error:
								error instanceof Error
									? error.message
									: String(error),
						},
					})
				} finally {
					exitProcess(0)
				}
			})()
		}

		return shutdownPromise
	}

	const onSigterm = () => {
		void shutdown('SIGTERM')
	}
	const onSigint = () => {
		void shutdown('SIGINT')
	}

	processLike.once('SIGTERM', onSigterm)
	processLike.once('SIGINT', onSigint)

	return () => {
		processLike.removeListener('SIGTERM', onSigterm)
		processLike.removeListener('SIGINT', onSigint)
	}
}
