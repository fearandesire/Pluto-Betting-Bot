import type { Context, Next } from 'koa'
import { v4 as uuidv4 } from 'uuid'

/**
 * Creates and returns the request ID middleware
 * Checks for existing request ID in common header variations and generates a new one if none exists
 */
export function createRequestIdMiddleware() {
	return async (ctx: Context, next: Next) => {
		const existingRequestId =
			ctx.get('X-Request-ID') ||
			ctx.get('Request-ID') ||
			ctx.get('reqId') ||
			ctx.get('x-request-id')

		ctx.state.reqId = existingRequestId || uuidv4()
		ctx.set('reqId', ctx.state.reqId)
		await next()
	}
}
