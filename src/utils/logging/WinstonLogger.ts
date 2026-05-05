import * as winston from 'winston'
import 'winston-transport'
import { fullFormat } from 'winston-error-format'
import env from '#lib/startup/env.js'
import { createConsoleTransport } from './transports/consoleTransport.js'
import { createLokiTransport } from './transports/lokiTransport.js'

/**
 * Renames Winston's `message` field to `msg` so JSON output matches the
 * Pino-compatible structured-logging contract used across our services.
 *
 * Applied at the transport level (console-prod and Loki) so the dev
 * console renderer is left untouched.
 */
export const messageToMsg = winston.format((info) => {
	if (info.message != null && info.msg == null) {
		info.msg = info.message as string
		delete info.message
	}
	return info
})

/**
 * Logger-level format: shared, transport-agnostic transformations only.
 *
 * Encoding (json, colorize, padLevels, consoleFormat) is intentionally NOT
 * applied here — each transport owns its own encoding pipeline. Putting
 * `winston.format.json()` at the logger level mutates `info[Symbol(MESSAGE)]`
 * before transport formats run, which silently breaks the pretty dev
 * console renderer (`winston-console-format`) for any log carrying
 * structured metadata.
 *
 * `errors({ stack: true })` normalizes thrown Error instances passed via
 * the `err` field; `fullFormat()` (winston-error-format) walks nested
 * errors and serializes their full property bag.
 */
const createBaseFormat = () => {
	return winston.format.combine(
		winston.format.errors({ stack: true }),
		fullFormat(),
	)
}

const createTransports = (customLabels: Record<string, string> = {}) => {
	const transports = [
		createConsoleTransport(),
		createLokiTransport({ customLabels }),
	]

	return transports.filter(
		(transport): transport is NonNullable<typeof transport> =>
			transport !== null,
	)
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
	/** Custom labels to add to Loki transport (low cardinality only). */
	readonly customLabels?: Record<string, string>
}

const APP = process.env.APP_NAME ?? process.env.SERVICE_NAME ?? 'PLUTO-DISCORD'
const VERSION = env.PROJECT_VERSION
const ENV = env.NODE_ENV

/**
 * Creates the root Winston logger.
 *
 * Identity fields (`app`, `version`, `env`) are bound on `defaultMeta` so
 * every log line carries them automatically. Per the structured-logging
 * contract, callers attach **placement** (`component` + one of
 * `command`/`handler`/`job`/`route`) via {@link createLogger} child
 * loggers at module boundaries, and **operation** (`event = domain.action`)
 * per call.
 */
export const createRootLogger = (config: LoggerConfig = {}) => {
	return winston.createLogger({
		level: resolveLogLevel(),
		format: createBaseFormat(),
		defaultMeta: {
			app: APP,
			version: VERSION,
			env: ENV,
		},
		transports: createTransports(config.customLabels),
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
 * @example
 * ```ts
 * const log = createLogger({ component: 'event', handler: 'chatInputCommandSuccess' })
 * log.info('Chat input command completed', { event: 'command.success', durationMs: 23 })
 * ```
 *
 * @param context Placement fields. Should include `component` and one of
 *   `command` | `handler` | `job` | `route` per the structured-logging
 *   field taxonomy. Avoid putting per-call dimensions (userId, requestId,
 *   etc.) here — pass those on the log call or via a further `.child()`.
 */
export const createLogger = (context: Record<string, string>): winston.Logger =>
	logger.child(context)
