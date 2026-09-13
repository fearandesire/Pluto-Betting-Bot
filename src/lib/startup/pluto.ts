import { configureSystemNotificationDelivery } from '../../utils/api/routes/notifications/delivery-queue.js'
import { logger } from '../../utils/logging/WinstonLogger.js'
import env, { isSystemStartupMode, type ParsedStartupEnv } from './env.js'
import { installShutdownHandlers } from './shutdown.js'

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
	installShutdownHandlers?: typeof installShutdownHandlers
	exitProcess?: (code: number) => never | void
}

async function initializeRedisBackedStartupServices(
	startupEnv: ParsedStartupEnv,
) {
	// These modules intentionally start Koa, Redis queues, and cron workers when
	// loaded, so startup keeps the side-effect imports behind the explicit boot step.
	await import('./cache.js')
	const { AlertReporter, setDefaultAlertReporter } = await import(
		'../../services/alerts/alert-reporter.js'
	)
	const { RedisAlertIncidentStore } = await import(
		'../../services/alerts/redis-alert-incident-store.js'
	)
	const { default: redis } = await import(
		'../../utils/cache/redis-instance.js'
	)
	const { logger: alertLogger } = await import(
		'../../utils/logging/WinstonLogger.js'
	)
	setDefaultAlertReporter(
		new AlertReporter(new RedisAlertIncidentStore(redis), alertLogger, {
			version: startupEnv.PROJECT_VERSION,
			environment: startupEnv.NODE_ENV,
		}),
	)
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

	await initializeRedisBackedStartupServices(startupEnv)
}

export async function initializeSystemStartupServices(
	startupEnv: ParsedStartupEnv = env,
) {
	await initializeRedisBackedStartupServices(startupEnv)
	configureSystemNotificationDelivery()
}

export async function startPluto({
	client,
	env: startupEnv = env,
	initializeStartupServices: initializeServices = () =>
		initializeStartupServices(startupEnv),
	initializeSystemStartupServices: initializeSystemServices = () =>
		initializeSystemStartupServices(startupEnv),
	installShutdownHandlers: setupShutdownHandlers = installShutdownHandlers,
	exitProcess = process.exit,
}: StartPlutoOptions): Promise<void> {
	try {
		if (isSystemStartupMode(startupEnv)) {
			await initializeSystemServices()
			setupShutdownHandlers({ client })
			logger.info({
				message:
					'Pluto system mode is up without Discord gateway login',
				source: 'startup:system',
			})
			return
		}

		await initializeServices()
		await client.login(startupEnv.TOKEN)
		setupShutdownHandlers({ client })
		logger.info('Pluto is up and running!')
	} catch (error) {
		logger.error({
			message: 'Failed to login',
		})
		client.logger.fatal({ message: 'Pluto startup failed', error })
		client.destroy()
		exitProcess(1)
	}
}
