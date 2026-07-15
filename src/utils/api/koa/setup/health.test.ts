import { createServer, type Server } from 'node:http'
import Koa from 'koa'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApiKeyAuthMiddleware } from './apiKeyAuth.js'
import { createHealthMiddleware } from './health.js'

vi.mock('../../../../lib/startup/env.js', () => ({
	default: { API_KEY: 'system-api-key' },
}))

vi.mock('../../../logging/WinstonLogger.js', () => ({
	logger: { warn: vi.fn() },
}))

describe('Koa health route', () => {
	let server: Server | undefined

	afterEach(async () => {
		if (server?.listening) {
			await new Promise<void>((resolve, reject) => {
				server.close((error) => (error ? reject(error) : resolve()))
			})
		}
	})

	async function request(path: string, init?: RequestInit) {
		const app = new Koa()
		app.use(createHealthMiddleware())
		app.use(createApiKeyAuthMiddleware())
		app.use(async (ctx) => {
			ctx.status = 204
		})
		server = createServer(app.callback())
		await new Promise<void>((resolve) => {
			server.listen(0, '127.0.0.1', () => resolve())
		})
		const address = server.address()
		if (!address || typeof address === 'string') {
			throw new Error('Test server did not expose a TCP address')
		}

		return fetch(`http://127.0.0.1:${address.port}${path}`, init)
	}

	it('allows unauthenticated GET /health', async () => {
		const response = await request('/health')

		expect(response.status).toBe(200)
		expect(await response.json()).toEqual({ status: 'ok' })
	})

	it('does not weaken API-key auth for mutation routes', async () => {
		const response = await request('/props/daily', { method: 'POST' })

		expect(response.status).toBe(401)
		expect(await response.json()).toMatchObject({
			code: 'MISSING_API_KEY',
		})
	})
})
