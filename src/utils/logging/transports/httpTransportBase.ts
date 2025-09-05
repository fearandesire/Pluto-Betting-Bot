import {
	createHttpBaseFormat,
	DEFAULT_HTTP_METADATA,
} from '../formats/baseFormat.js'

/**
 * Common configuration interface for HTTP-based transports
 */
export interface HttpTransportBaseConfig {
	/** Service name for logging identification */
	readonly service?: string
	/** Environment name (development, production, etc.) */
	readonly environment?: string
}

/**
 * Creates standardized metadata for HTTP transports
 * Ensures consistent service identification across all remote logging destinations
 *
 * @param config - Optional configuration to override defaults
 * @returns Standardized metadata object
 */
export const createHttpTransportMetadata = (
	config: HttpTransportBaseConfig = {},
) => {
	return {
		...DEFAULT_HTTP_METADATA,
		service: config.service || DEFAULT_HTTP_METADATA.service,
		environment: config.environment,
	}
}

/**
 * Creates the standardized format for all HTTP transports
 * Provides consistent formatting across BetterStack, Loki, and any future HTTP destinations
 *
 * @returns Winston format combination optimized for HTTP transport destinations
 */
export const createHttpTransportFormat = () => {
	return createHttpBaseFormat()
}

/**
 * Standard error handler for HTTP transport connection issues
 * Provides consistent error logging without causing cascade failures
 *
 * @param transportName - Name of the transport for error identification
 * @returns Error handler function
 */
export const createHttpTransportErrorHandler = (transportName: string) => {
	return (error: Error) => {
		console.error(
			`${transportName} transport connection error:`,
			error.message,
		)
	}
}
