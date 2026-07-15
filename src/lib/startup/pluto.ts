import { configureSystemNotificationDelivery } from '../../utils/api/routes/notifications/delivery-queue.js'
import { logger } from '../../utils/logging/WinstonLogger.js'
import env, { isSystemStartupMode, type ParsedStartupEnv } from './env.js'

interface StartupClient {
	login(token: string): Promise<unknown>
	destroy(): void
	logger: {
		fatal(error: unknown): unknown
	}
}

export interface StartPlutoOptions {
	client: StartupClient
	env?: ParsedStartupEnv
	initializeStartupServices?: () => Promise<void>
	initializeSystemStartupServices?: () => Promise<void>
	exitProcess?: (code: number) => never | void
}

async function initializeRedisBackedStartupServices() {
	// These modules intentionally start Koa, Redis queues, and cron workers when
	// loaded, so startup keeps the side-effect imports behind the explicit boot step.
	await import('./cache.js')
	await import('../../utils/api/Khronos/KhronosInstances.js')
	await import('../../utils/api/koa/index.js')
	await import('../../utils/cache/queue/ChannelCreationQueue.js')
	await import('../../utils/cron/index.js')
}

export async function initializeStartupServices(
	startupEnv: ParsedStartupEnv = env,
) {
	if (startupEnv.USE_MOCK_DATA) {
		logger.info({
			message:
				'Mock data mode enabled; skipping Redis-backed startup services',
			source: 'startup:mock-data',
		})
		return
	}

	await initializeRedisBackedStartupServices()
}

export async function initializeSystemStartupServices() {
	configureSystemNotificationDelivery()
	await initializeRedisBackedStartupServices()
}

export async function startPluto({
	client,
	env: startupEnv = env,
	initializeStartupServices: initializeServices = () =>
		initializeStartupServices(startupEnv),
	initializeSystemStartupServices:
		initializeSystemServices = initializeSystemStartupServices,
	exitProcess = process.exit,
}: StartPlutoOptions): Promise<void> {
	try {
		if (isSystemStartupMode(startupEnv)) {
			await initializeSystemServices()
			logger.info({
				message:
					'Pluto system mode is up without Discord gateway login',
				source: 'startup:system',
			})
			return
		}

		await initializeServices()
		await client.login(startupEnv.TOKEN)
		logger.info('Pluto is up and running!')
	} catch (error) {
		logger.error({
			message: 'Failed to login',
		})
		client.logger.fatal(error)
		client.destroy()
		exitProcess(1)
	}
}
