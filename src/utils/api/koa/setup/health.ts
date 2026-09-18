import type { Context, Next } from 'koa'

export function createHealthMiddleware() {
	return async (ctx: Context, next: Next) => {
		if (ctx.method === 'GET' && ctx.path === '/health') {
			ctx.status = 200
			ctx.body = { status: 'ok' }
			return
		}

		await next()
	}
}
