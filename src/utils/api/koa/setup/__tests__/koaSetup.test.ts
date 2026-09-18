import { describe, expect, it, vi } from 'vitest'

type LoggerOptions = { reqUnselect: string[]; resUnselect: string[] }

const { loggerMock } = vi.hoisted(() => ({
	loggerMock: vi.fn(
		(_options: LoggerOptions) =>
			(_ctx: unknown, next: () => Promise<void>) =>
				next(),
	),
}))

vi.mock('koa2-winston', () => ({ logger: loggerMock }))
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
vi.mock('../logging.js', () => ({
	captureRequestIdentity: () => (_ctx: unknown, next: () => Promise<void>) =>
		next(),
}))
vi.mock('../requestId.js', () => ({
	createRequestIdMiddleware:
		() => (_ctx: unknown, next: () => Promise<void>) =>
			next(),
}))

import { setupKoaApp } from '../koaSetup.js'

describe('setupKoaApp', () => {
	it('strips credential headers from the request/response log', async () => {
		await setupKoaApp()

		expect(loggerMock).toHaveBeenCalledTimes(1)
		const [options] = loggerMock.mock.calls[0]

		expect(options.reqUnselect).toEqual(
			expect.arrayContaining([
				'header.cookie',
				'header.x-api-key',
				'header.admin-token',
				'header.authorization',
			]),
		)
		expect(options.resUnselect).toEqual(
			expect.arrayContaining(['header.set-cookie']),
		)
	})
})
