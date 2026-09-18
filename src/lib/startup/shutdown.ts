import { logger } from '../../utils/logging/WinstonLogger.js'
import {
	getRegisteredShutdownQueues,
	registerShutdownQueue,
} from './shutdown-registry.js'

export {
	getRegisteredShutdownQueues,
	registerShutdownQueue,
} from './shutdown-registry.js'

export const QUEUE_SHUTDOWN_TIMEOUT_MS = 30_000

type ShutdownSignal = 'SIGTERM' | 'SIGINT'

interface ShutdownClient {
	destroy(): void
}

interface ShutdownProcess {
	on(signal: ShutdownSignal, listener: () => void): unknown
	removeListener(signal: ShutdownSignal, listener: () => void): unknown
}

export interface InstallShutdownHandlersOptions {
	client: ShutdownClient
	processLike?: ShutdownProcess
	closeQueues?: (timeoutMs: number) => Promise<boolean | void>
	exitProcess?: (code: number) => never | void
	queueShutdownTimeoutMs?: number
}

export async function closeQueueWorkers(
	timeoutMs = QUEUE_SHUTDOWN_TIMEOUT_MS,
): Promise<boolean> {
	const results = await Promise.allSettled(
		getRegisteredShutdownQueues().map((queue) => queue.close(timeoutMs)),
	)
	const failed = results.find(
		(result): result is PromiseRejectedResult =>
			result.status === 'rejected',
	)
	if (failed) throw failed.reason
	return results.some(
		(result) => result.status === 'fulfilled' && result.value === true,
	)
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
			let timedOut = false
			let failed = false
			let hardExitTimer: ReturnType<typeof setTimeout> | undefined
			shutdownPromise = (async () => {
				logger.info({
					message: `Received ${signal}; shutting down Pluto`,
					source: 'startup:shutdown',
				})

				try {
					hardExitTimer = setTimeout(() => {
						timedOut = true
						logger.error({
							message: 'Queue shutdown exceeded hard deadline',
							source: 'startup:shutdown',
						})
						exitProcess(1)
					}, queueShutdownTimeoutMs + 5_000)
					hardExitTimer.unref()

					const forceClosed = await closeQueues(
						queueShutdownTimeoutMs,
					)
					if (forceClosed) failed = true
				} catch (error) {
					failed = true
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
					if (hardExitTimer) clearTimeout(hardExitTimer)
					if (!timedOut) {
						client.destroy()
						exitProcess(failed ? 1 : 0)
					}
				}
			})()
		} else {
			logger.warn({
				message: `Received ${signal} again; shutdown already in progress`,
				source: 'startup:shutdown',
			})
		}

		return shutdownPromise
	}

	const onSigterm = () => {
		void shutdown('SIGTERM')
	}
	const onSigint = () => {
		void shutdown('SIGINT')
	}

	processLike.on('SIGTERM', onSigterm)
	processLike.on('SIGINT', onSigint)

	return () => {
		processLike.removeListener('SIGTERM', onSigterm)
		processLike.removeListener('SIGINT', onSigint)
	}
}
