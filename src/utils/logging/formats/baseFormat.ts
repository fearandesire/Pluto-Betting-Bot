import * as winston from 'winston'
import { fullFormat } from 'winston-error-format'

/**
 * Creates the standardized base format for HTTP transports
 *
 * This format ensures consistency across all remote logging destinations by providing:
 * - ISO timestamp for precise log ordering
 * - Full error formatting with stack traces and nested error properties
 * - JSON serialization for structured logging
 *
 * @returns Winston format combination optimized for HTTP transport destinations
 */
export const createHttpBaseFormat = () => {
	return winston.format.combine(
		winston.format.timestamp(),
		fullFormat(),
		winston.format.json(),
	)
}

// fallback
export const DEFAULT_HTTP_METADATA = {
	service: 'GLOBAL-HTTP',
} as const
