import type { Context, Next } from 'koa'
import env from '../../../../lib/startup/env.js'
import { logger } from '../../../logging/WinstonLogger.js'

/**
 * The external uptime probe calls this path without a key and expects 401.
 * Its rejections log at debug so they do not bury real auth failures.
 */
export const KEYLESS_PROBE_PATH = '/api/pluto/health'

/**
 * Creates and returns the API key authentication middleware
 */
export function createApiKeyAuthMiddleware() {
	return async (ctx: Context, next: Next) => {
		// Skip authentication for admin routes
		if (ctx.path.startsWith('/api/pluto/admin')) {
			return next()
		}

		const apiKey = ctx.get('X-API-Key') || ctx.query.apiKey

		if (!apiKey) {
			ctx.status = 401
			ctx.body = {
				status: 'error',
				code: 'MISSING_API_KEY',
				message: 'API key is required',
			}
			const level = ctx.path === KEYLESS_PROBE_PATH ? 'debug' : 'warn'
			logger[level]('Request rejected due to missing API key', {
				path: ctx.path,
				method: ctx.method,
				reqId: ctx.state.reqId,
			})
			return
		}

		if (apiKey !== env.API_KEY) {
			ctx.status = 401
			ctx.body = {
				status: 'error',
				code: 'INVALID_API_KEY',
				message: 'Invalid API key',
			}
			logger.warn('Request rejected due to invalid API key', {
				path: ctx.path,
				method: ctx.method,
				reqId: ctx.state.reqId,
			})
			return
		}

		ctx.state.apiKeyAuthenticated = true
		await next()
	}
}
