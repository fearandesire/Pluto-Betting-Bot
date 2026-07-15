import * as winston from 'winston'
import 'winston-transport'
import { fullFormat } from 'winston-error-format'
import env from '#lib/startup/env.js'
import { createConsoleTransport } from './transports/consoleTransport.js'

/**
 * Logger-level format: shared, transport-agnostic transformations only.
 *
 * Encoding (json, colorize, padLevels, consoleFormat) is intentionally NOT
 * applied here — each transport owns its own encoding pipeline.
 */
const createBaseFormat = () => {
	return winston.format.combine(
		winston.format.errors({ stack: true }),
		fullFormat(),
	)
}

const createTransports = () => {
	return [createConsoleTransport()]
}

/**
 * Maps the Sapphire-style `LOG_LEVEL` enum value to a Winston npm-level
 * string. Sapphire defines `Trace` and `Fatal` which Winston's default
 * `npm` levels lack, so they collapse to the nearest equivalent.
 */
const sapphireToWinstonLevel: Record<typeof env.LOG_LEVEL, string> = {
	Trace: 'debug',
	Debug: 'debug',
	Info: 'info',
	Warn: 'warn',
	Error: 'error',
	Fatal: 'error',
}

const resolveLogLevel = (): string => {
	const raw = process.env.LOG_LEVEL
	if (raw && /^(error|warn|info|http|verbose|debug|silly)$/.test(raw)) {
		return raw
	}
	return sapphireToWinstonLevel[env.LOG_LEVEL]
}

export interface LoggerConfig {
	/** Optional placement overrides for child loggers. */
	readonly customLabels?: Record<string, string>
}

const SERVICE =
	process.env.OTEL_SERVICE_NAME ?? process.env.SERVICE_NAME ?? 'pluto'
const APP = process.env.APP_NAME ?? SERVICE
const VERSION = env.PROJECT_VERSION
const ENV = env.NODE_ENV
const COMPONENT = process.env.COMPONENT ?? 'bot'

/**
 * Creates the root Winston logger.
 *
 * Identity fields follow fnx-observability contract v1 (`service`, `app`,
 * `component`, `environment`). Prod path is JSON stdout → Alloy only —
 * do not reintroduce winston-loki dual-ship.
 */
export const createRootLogger = (_config: LoggerConfig = {}) => {
	return winston.createLogger({
		level: resolveLogLevel(),
		format: createBaseFormat(),
		defaultMeta: {
			service: SERVICE,
			app: APP,
			component: COMPONENT,
			environment: ENV,
			version: VERSION,
			deployment: {
				service: SERVICE,
				version: VERSION,
				environment: ENV,
			},
		},
		transports: createTransports(),
	})
}

/**
 * The root logger. Prefer {@link createLogger} for new code so each module
 * boundary gets its own placement context.
 */
export const logger = createRootLogger()

/**
 * Creates a child logger bound with placement context.
 *
 * @param context Placement fields. Should include `component` and one of
 *   `command` | `handler` | `job` | `route` per the structured-logging
 *   field taxonomy.
 */
export const createLogger = (context: Record<string, string>): winston.Logger =>
	logger.child(context)
