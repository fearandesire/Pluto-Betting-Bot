import * as winston from 'winston'
import { consoleFormat } from 'winston-console-format'
import { fullFormat } from 'winston-error-format'
import env from '#lib/startup/env.js'

/**
 * Creates a console transport with environment-aware formatting.
 *
 * Selection precedence:
 * 1. `LOG_FORMAT=pretty` -> dev renderer
 * 2. `LOG_FORMAT=json`   -> JSON renderer (contract v1 shape)
 * 3. Otherwise: pretty when `NODE_ENV !== 'production'`, JSON otherwise
 *
 * Production JSON keeps Winston's native `message` field (fnx-observability
 * contract v1). Single path: stdout → Docker → Alloy. No remote shippers.
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
				metaStrip: [
					'timestamp',
					'service',
					'app',
					'component',
					'environment',
					'version',
					'deployment',
				],
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
