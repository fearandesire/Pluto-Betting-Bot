import { describe, expect, it, vi } from 'vitest'

type LoggerOptions = Record<string, unknown>

const { loggerMock } = vi.hoisted(() => ({
	loggerMock: vi.fn(
		(_options: LoggerOptions) =>
			(_ctx: unknown, next: () => Promise<void>) =>
				next(),
	),
}))

vi.mock('koa2-winston', async (importActual) => ({
	...(await importActual<typeof import('koa2-winston')>()),
	logger: loggerMock,
}))
vi.mock('../../../../logging/transports/consoleTransport.js', () => ({
	createConsoleTransport: () => ({}),
}))
vi.mock('../../../requests/middleware.js', () => ({
	pageNotFound: (_ctx: unknown, next: () => Promise<void>) => next(),
}))
vi.mock('../apiKeyAuth.js', () => ({
	createApiKeyAuthMiddleware:
		() => (_ctx: unknown, next: () => Promise<void>) =>
			next(),
}))
vi.mock('../bullBoard.js', () => ({ setupBullBoard: vi.fn() }))
vi.mock('../errorHandler.js', () => ({
	createErrorHandler: () => (_ctx: unknown, next: () => Promise<void>) =>
		next(),
}))
vi.mock('../health.js', () => ({
	createHealthMiddleware: () => (_ctx: unknown, next: () => Promise<void>) =>
		next(),
}))
vi.mock('../requestId.js', () => ({
	createRequestIdMiddleware:
		() => (_ctx: unknown, next: () => Promise<void>) =>
			next(),
}))

import { generateFormat } from 'koa2-winston'
import { setupKoaApp } from '../koaSetup.js'

const accessLogLine = async (header: Record<string, string>) => {
	await setupKoaApp()
	const [options] = loggerMock.mock.lastCall ?? []
	const format = generateFormat(options)
	return JSON.parse(
		format({
			started_at: 1,
			duration: 2,
			level: 'info',
			message: 'HTTP POST /api/pluto/props/daily',
			req: { header, method: 'POST', url: '/api/pluto/props/daily' },
			res: {
				header: { 'set-cookie': 'sid=1', reqid: 'r-1' },
				status: 202,
			},
		}),
	)
}

describe('setupKoaApp access log', () => {
	it('logs only allowlisted request headers', async () => {
		const line = await accessLogLine({
			'user-agent': 'khronos/1.0',
			'x-request-id': 'delivery-1',
			'x-service-name': 'khronos',
			'cf-connecting-ip': '203.0.113.9',
			'x-forwarded-for': '203.0.113.9',
			'x-real-ip': '203.0.113.9',
			'cf-ipcountry': 'US',
			'cf-ipcity': 'Austin',
			'cf-iplatitude': '30.2',
			'cf-ray': 'abc-DFW',
			'true-client-ip': '203.0.113.9',
			cookie: 'sid=1',
			'x-api-key': 'secret',
			'admin-token': 'secret',
			authorization: 'Bearer secret',
		})

		expect(line.req.header).toEqual({
			'user-agent': 'khronos/1.0',
			'x-request-id': 'delivery-1',
			'x-service-name': 'khronos',
		})
		expect(line.req).toMatchObject({ method: 'POST' })
		expect(JSON.stringify(line)).not.toMatch(/203\.0\.113\.9|secret|Austin/)
	})

	it('keeps the response request id and drops set-cookie', async () => {
		const line = await accessLogLine({})
		expect(line.res.header.reqid).toBe('r-1')
		expect(line.res.header['set-cookie']).toBeNull()
	})
})
