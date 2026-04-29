import winston from 'winston'
import LokiTransport from 'winston-loki'
import env from '#lib/startup/env.js'
import { messageToMsg } from '../WinstonLogger.js'
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
	/** Labels to attach to all logs */
	readonly labels?: Record<string, string>
	/**
	 * Additional custom labels to merge with default labels.
	 * Each label value can be a string, boolean, object, or array.
	 *
	 * NOTE: Loki labels must stay low-cardinality. Per-call dimensions
	 * (userId, requestId, guildId, ...) belong in the JSON log fields, not
	 * as labels.
	 */
	readonly customLabels?: Record<string, string | boolean | object | any[]>
}

const APP = process.env.APP_NAME ?? process.env.SERVICE_NAME ?? 'PLUTO-DISCORD'

/**
 * Creates default configuration for Loki transport.
 *
 * Labels mirror the structured-logging identity contract (`app`, `env`,
 * `version`) so dashboards can pivot on the same fields whether they read
 * from a label index or the JSON payload. Placement fields like
 * `component` are intentionally NOT included as global labels — they are
 * set per-module via {@link createLogger} child loggers and travel in the
 * log line itself.
 */
const createDefaultConfig = (
	customLabels: Record<string, string | boolean | object | any[]> = {},
): LokiConfig | null => {
	const host = env.LOKI_URL
	const user = env.LOKI_USER
	const password = env.LOKI_PASS

	if (!host || !user || !password) {
		console.error('[PLUTO] ERROR: Loki credentials are not configured')
		return null
	}

	return {
		host,
		username: user,
		password: password,
		environment: env.NODE_ENV,
		labels: {
			app: APP,
			env: env.NODE_ENV,
			version: env.PROJECT_VERSION,
			log_type: 'application',
			...customLabels,
		},
	}
}

/**
 * Creates a transport for Grafana Loki logging
 * @param config - Optional configuration override
 * @returns Configured Loki transport or null if credentials are missing
 */
export const createLokiTransport = (config: Partial<LokiConfig> = {}) => {
	const customLabels = config.customLabels || {}
	const defaultConfig = createDefaultConfig(customLabels)

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
		// `messageToMsg` aligns the JSON line with the structured-logging
		// contract (`msg` rather than Winston's native `message`).
		format: winston.format.combine(messageToMsg(), winston.format.json()),
		replaceTimestamp: true,
		onConnectionError: createHttpTransportErrorHandler('Loki'),
	})
}
