import type { Context, Next } from 'koa';
import env from '../../../lib/startup/env.js';
import { WinstonLogger } from '../../logging/WinstonLogger.js';

/**
 * Creates and returns the API key authentication middleware
 */
export function createApiKeyAuthMiddleware() {
	return async (ctx: Context, next: Next) => {
		// Skip authentication for admin routes
		if (ctx.path.startsWith('/admin')) {
			return next();
		}

		const apiKey = ctx.get('X-API-Key') || ctx.query.apiKey;

		if (!apiKey) {
			ctx.status = 401;
			ctx.body = {
				status: 'error',
				code: 'MISSING_API_KEY',
				message: 'API key is required',
			};
			WinstonLogger.warn('Request rejected due to missing API key', {
				path: ctx.path,
				method: ctx.method,
				reqId: ctx.state.reqId,
			});
			return;
		}

		if (apiKey !== env.API_KEY) {
			ctx.status = 401;
			ctx.body = {
				status: 'error',
				code: 'INVALID_API_KEY',
				message: 'Invalid API key',
			};
			WinstonLogger.warn('Request rejected due to invalid API key', {
				path: ctx.path,
				method: ctx.method,
				reqId: ctx.state.reqId,
			});
			return;
		}

		await next();
	};
}
