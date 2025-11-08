import { logger } from '../../../logging/WinstonLogger.js'

/**
 * Creates and returns the logging middleware
 * Ignores paths that start with /admin
 */
export function createLoggingMiddleware() {
	return (str: string, args: any[]) => {
		const [, method = '', path = '', status = '', time = ''] = args

		// Skip logging for /admin paths
		if (path.startsWith('/api/pluto/admin')) {
			return
		}

		const duration = typeof time === 'number' ? time : 0
		const statusCode = Number.parseInt(status)
		const logData = {
			context: 'http',
			method,
			path,
			...(status && { status }),
			duration,
			reqId: str.includes('-->')
				? args[4]?.state?.reqId
				: args[3]?.state?.reqId,
			// Additional labels for better Loki querying
			http_method: method,
			http_path: path,
			http_status: status,
			response_time_ms: duration,
			// Route categorization for easier filtering
			route_type: path.startsWith('/api/pluto/') ? 'pluto' : 'external',
			// Request classification
			request_type: 'http_request',
		}

		if ((statusCode >= 200 && statusCode < 300) || !statusCode) {
			logger.info(`${method} ${path} ${status} ${duration}ms`, logData)
		} else {
			logger.error(`${method} ${path} ${status} ${duration}ms`, logData)
		}
	}
}
