import * as winston from 'winston'
import 'winston-transport'
import { fullFormat } from 'winston-error-format'
import env  from '#lib/startup/env.js'
import { createConsoleTransport } from './transports/consoleTransport.js'
import { createLokiTransport } from './transports/lokiTransport.js'

/**
 * Creates the base logger format for the main logger instance
 * @returns Winston format combination for base logging
 *
 * Integrates winston-error-format's fullFormat to ensure error objects are logged with all properties, including nested errors and stack traces.
 */
const createBaseFormat = () => {
	return winston.format.combine(
		winston.format.timestamp(),
		fullFormat(),
		winston.format.json(),
	)
}

/**
 * Creates all configured transports, filtering out any that are null
 * @param serviceName - The service name to use for logging identification
 */
const createTransports = (serviceName: string) => {
	const transports = [
		createConsoleTransport(),
		createLokiTransport({ serviceName }),
	]

	// Filter out null transports and ensure type safety
	return transports.filter(
		(transport): transport is NonNullable<typeof transport> =>
			transport !== null,
	)
}

/**
 * Configuration interface for creating a Winston logger
 */
export interface LoggerConfig {
	/** Service name for logging identification */
	readonly serviceName?: string
	/** Application name */
	readonly appName?: string
	/** Log level override */
	readonly logLevel?: string
	/** Environment override */
	readonly environment?: string
}

/**
 * Creates a Winston logger instance with configurable service name and settings
 * @param config - Configuration options for the logger
 * @returns Configured Winston logger instance
 */
export const createLogger = (config: LoggerConfig = {}) => {
	const serviceName = config.serviceName!
	const appName = config.appName || serviceName
	const logLevel = config.logLevel || env.logLevel || 'info'
	const environment = config.environment || env.NODE_ENV

	return winston.createLogger({
		level: logLevel,
		format: createBaseFormat(),
		defaultMeta: {
			environment,
			app: appName,
			service: serviceName,
		},
		transports: createTransports(serviceName),
	})
}

/**
 * Default logger instance using DEXTER-CORE as service name
 * For plug-in-able usage, prefer using createLogger() with custom service name
 */
export const logger = createLogger({
	serviceName: 'PLUTO-DISCORD',
	appName: 'PLUTO-DISCORD',
})
 