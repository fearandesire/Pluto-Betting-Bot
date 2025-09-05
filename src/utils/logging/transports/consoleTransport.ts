import * as winston from 'winston'
import { consoleFormat } from 'winston-console-format'
import { fullFormat } from 'winston-error-format'
import env from '#lib/startup/env.js'

/**
 * Creates a console transport with environment-aware formatting
 *
 * - Production: structured JSON for ingestion (e.g., Loki/Grafana)
 * - Development: winston-console-format for readable, colorized output with object inspection
 *
 * @returns Configured console transport
 */
export const createConsoleTransport = () => {
	const isProduction = env.NODE_ENV === 'production'

	if (isProduction) {
		// Production: Simple JSON format for log aggregation systems
		return new winston.transports.Console({
			format: winston.format.combine(
				winston.format.timestamp(),
				fullFormat(),
				winston.format.json(),
			),
		})
	}

	// Development: Rich, colorized console output with object inspection
	return new winston.transports.Console({
		format: winston.format.combine(
			winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
			winston.format.colorize({ all: true }),
			winston.format.padLevels(),
			consoleFormat({
				showMeta: true,
				metaStrip: ['timestamp', 'service'],
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
