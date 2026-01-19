import type { Context, Next } from 'koa'
import { logger } from '../../../logging/WinstonLogger.js'

/**
 * Middleware to capture incoming request identification headers
 * Stores User-Agent and X-Service-Name in ctx.state for logging
 */
export function captureRequestIdentity() {
	return async (ctx: Context, next: Next) => {
		ctx.state.userAgent = ctx.get('User-Agent') || 'unknown'
		ctx.state.serviceName = ctx.get('X-Service-Name') || 'unknown'
		await next()
	}
}

/**
 * Creates and returns the logging middleware
 * Ignores paths that start with /admin
 * Implements "wide event" logging with all request context in a single log line
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

		// Extract context from args (koa-logger format)
		const ctx = str.includes('-->') ? args[4] : args[3]
		const reqId = ctx?.state?.reqId
		const userAgent =
			ctx?.state?.userAgent ||
			ctx?.request?.headers?.['user-agent'] ||
			'unknown'
		const serviceName =
			ctx?.state?.serviceName ||
			ctx?.request?.headers?.['x-service-name'] ||
			'unknown'

		// Wide event log: single canonical log line with all context
		const logData = {
			context: 'http',
			method,
			path,
			...(status && { status }),
			duration,
			reqId,
			userAgent,
			serviceName,
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
