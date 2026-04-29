import * as winston from 'winston'
import { consoleFormat } from 'winston-console-format'
import { fullFormat } from 'winston-error-format'
import env from '#lib/startup/env.js'
import { messageToMsg } from '../WinstonLogger.js'

/**
 * Creates a console transport with environment-aware formatting.
 *
 * Selection precedence (matches the structured-logging skill contract):
 * 1. `LOG_FORMAT=pretty` -> dev renderer
 * 2. `LOG_FORMAT=json`   -> JSON renderer
 * 3. Otherwise: dev renderer when `NODE_ENV !== 'production'`, JSON otherwise
 *
 * - JSON path: `messageToMsg` rewrites Winston's `message` to `msg` so the
 *   line matches the Pino-compatible identity contract (`level`, `time`,
 *   `msg`, `app`, `version`, `env`, ...).
 * - Pretty path: `winston-console-format` renders human-readable lines with
 *   colors, short timestamps, and indented meta. It reads `info.message`
 *   directly, so `messageToMsg` is intentionally NOT applied here.
 */
export const createConsoleTransport = () => {
	const logFormat = process.env.LOG_FORMAT
	const usePretty =
		logFormat === 'pretty' ||
		(logFormat !== 'json' && env.NODE_ENV !== 'production')

	if (!usePretty) {
		return new winston.transports.Console({
			format: winston.format.combine(
				winston.format.timestamp(),
				fullFormat(),
				messageToMsg(),
				winston.format.json(),
			),
		})
	}

	return new winston.transports.Console({
		format: winston.format.combine(
			winston.format.timestamp({ format: 'HH:mm:ss' }),
			winston.format.colorize({ all: true }),
			winston.format.padLevels(),
			consoleFormat({
				showMeta: true,
				metaStrip: ['timestamp', 'app', 'version', 'env'],
				inspectOptions: {
					depth: Number.POSITIVE_INFINITY,
					colors: true,
					maxArrayLength: Number.POSITIVE_INFINITY,
					breakLength: 120,
					compact: Number.POSITIVE_INFINITY,
				},
			}),
		),
	})
}
