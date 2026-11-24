import { createServer, type Server } from 'node:http'
import Koa from 'koa'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { logger } from '../../../logging/WinstonLogger.js'
import { createApiKeyAuthMiddleware, KEYLESS_PROBE_PATH } from './apiKeyAuth.js'
import { createHealthMiddleware } from './health.js'

vi.mock('../../../../lib/startup/env.js', () => ({
	default: { API_KEY: 'system-api-key' },
}))

vi.mock('../../../logging/WinstonLogger.js', () => ({
	logger: { warn: vi.fn(), debug: vi.fn() },
}))

describe('Koa health route', () => {
	let server: Server | undefined

	afterEach(async () => {
		vi.clearAllMocks()
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

	it('rejects the keyless uptime probe with 401 and logs it at debug', async () => {
		const response = await request(KEYLESS_PROBE_PATH)

		expect(response.status).toBe(401)
		expect(await response.json()).toMatchObject({
			code: 'MISSING_API_KEY',
		})
		expect(logger.debug).toHaveBeenCalledWith(
			'Request rejected due to missing API key',
			expect.objectContaining({ path: KEYLESS_PROBE_PATH }),
		)
		expect(logger.warn).not.toHaveBeenCalled()
	})

	it('keeps missing-key rejections on other paths at warn', async () => {
		const response = await request('/api/pluto/props/daily')

		expect(response.status).toBe(401)
		expect(logger.warn).toHaveBeenCalledWith(
			'Request rejected due to missing API key',
			expect.objectContaining({ path: '/api/pluto/props/daily' }),
		)
		expect(logger.debug).not.toHaveBeenCalled()
	})
})
