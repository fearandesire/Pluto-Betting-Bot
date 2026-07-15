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
 * Koa middleware: one nested wide-event JSON log per request (contract v1).
 * Ships via Winston console → Docker stdout → Alloy. No Loki push.
 */
export function createHttpWideEventMiddleware() {
	return async (ctx: Context, next: Next) => {
		const start = Date.now()
		const path = ctx.path || ctx.url || ''

		try {
			await next()
		} finally {
			if (path.startsWith('/api/pluto/admin')) {
				return
			}

			const durationMs = Date.now() - start
			const statusCode = ctx.status || 0
			const outcome =
				statusCode >= 200 && statusCode < 300
					? 'success'
					: statusCode >= 400 && statusCode < 500
						? 'client_error'
						: statusCode >= 500
							? 'server_error'
							: 'unknown'

			const logData = {
				log_type: 'http_request',
				identification: {
					request_id: ctx.state.reqId,
				},
				http: {
					method: ctx.method,
					path,
					status_code: statusCode,
					duration_ms: durationMs,
					outcome,
				},
				client: {
					ip: ctx.ip,
					user_agent:
						ctx.state.userAgent ||
						ctx.get('User-Agent') ||
						'unknown',
					identity: '',
					service_name:
						ctx.state.serviceName ||
						ctx.get('X-Service-Name') ||
						'unknown',
				},
			}

			const message = `${ctx.method} ${path} ${statusCode} ${durationMs}ms`
			if (outcome === 'success' || outcome === 'unknown') {
				logger.info(message, logData)
			} else if (outcome === 'client_error') {
				logger.warn(message, logData)
			} else {
				logger.error(message, logData)
			}
		}
	}
}

/**
 * @deprecated Prefer {@link createHttpWideEventMiddleware}. Kept for callers
 * that still expect koa-logger-style args callback.
 */
export function createLoggingMiddleware() {
	return (str: string, args: any[]) => {
		const [, method = '', path = '', status = '', time = ''] = args

		if (typeof path === 'string' && path.startsWith('/api/pluto/admin')) {
			return
		}

		const duration = typeof time === 'number' ? time : 0
		const statusCode = Number.parseInt(String(status), 10) || 0
		const outcome =
			statusCode >= 200 && statusCode < 300
				? 'success'
				: statusCode >= 400 && statusCode < 500
					? 'client_error'
					: 'server_error'

		const ctx = str.includes('-->') ? args[4] : args[3]

		const logData = {
			log_type: 'http_request',
			identification: {
				request_id: ctx?.state?.reqId,
			},
			http: {
				method,
				path,
				status_code: statusCode,
				duration_ms: duration,
				outcome,
			},
			client: {
				user_agent:
					ctx?.state?.userAgent ||
					ctx?.request?.headers?.['user-agent'] ||
					'unknown',
				service_name:
					ctx?.state?.serviceName ||
					ctx?.request?.headers?.['x-service-name'] ||
					'unknown',
			},
		}

		const message = `${method} ${path} ${status} ${duration}ms`
		if ((statusCode >= 200 && statusCode < 300) || !statusCode) {
			logger.info(message, logData)
		} else {
			logger.error(message, logData)
		}
	}
}
