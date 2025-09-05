import winston from 'winston'
import LokiTransport from 'winston-loki'
import env  from '#lib/startup/env.js'
import {
	createHttpTransportErrorHandler,
	type HttpTransportBaseConfig,
} from './httpTransportBase.js'

/**
 * Configuration for Grafana Loki transport
 */
interface LokiConfig extends HttpTransportBaseConfig {
	/** Loki host URL */
	readonly host: string
	/** Basic auth username */
	readonly username: string
	/** Basic auth password/API token */
	readonly password: string
	/** Service name for logging identification */
	readonly serviceName?: string
	/** Labels to attach to all logs */
	readonly labels?: Record<string, string>
}

/**
 * Creates default configuration for Loki transport
 * @param serviceName - Optional service name override
 * @returns Default Loki configuration or null if credentials are missing
 */
const createDefaultConfig = (serviceName = 'DEXTER-CORE'): LokiConfig | null => {
	const host = env.LOKI_URL
	const user = env.LOKI_USER
	const password = env.LOKI_PASS

	if (!host || !user || !password) {
		console.error('[DEXTER] ERROR: Loki credentials are not configured')
		return null
	}

	return {
		host,
		username: user,
		password: password,
		serviceName,
		environment: env.NODE_ENV,
		labels: {
			app: serviceName,
			service: serviceName,
			environment: env.NODE_ENV,
		},
	}
}

/**
 * Creates a transport for Grafana Loki logging
 * @param config - Optional configuration override
 * @returns Configured Loki transport or null if credentials are missing
 */
export const createLokiTransport = (config: Partial<LokiConfig> = {}) => {
	const serviceName = config.serviceName || 'DEXTER-CORE'
	const defaultConfig = createDefaultConfig(serviceName)

	if (!defaultConfig) {
		// Return null if Loki credentials are not configured
		return null
	}

	const lokiConfig = { ...defaultConfig, ...config }

	return new LokiTransport({
		host: lokiConfig.host,
		basicAuth: `${lokiConfig.username}:${lokiConfig.password}`,
		labels: lokiConfig.labels,
		json: true,
		format: winston.format.json(),
		replaceTimestamp: true,
		onConnectionError: createHttpTransportErrorHandler('Loki'),
	})
}
