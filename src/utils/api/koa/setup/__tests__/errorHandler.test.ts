import type { Context } from 'koa'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../../../../logging/WinstonLogger.js', () => ({
	logger: { error: vi.fn() },
}))

import { createErrorHandler } from '../errorHandler.js'

describe('createErrorHandler', () => {
	it('does not expose internals from an unexpected failure', async () => {
		const ctx: {
			path: string
			method: string
			state: { reqId: string }
			status: number
			body?: unknown
		} = {
			path: '/channels/create',
			method: 'POST',
			state: { reqId: 'req-123' },
			status: 0,
			body: undefined,
		}
		const next = vi
			.fn()
			.mockRejectedValue(
				new Error('internal implementation detail must not be shown'),
			)

		await createErrorHandler()(ctx as unknown as Context, next)

		expect(ctx.status).toBe(500)
		expect(ctx.body).toEqual({
			status: 'error',
			code: 'INTERNAL_SERVER_ERROR',
			message:
				'Something went wrong while processing your request. Please try again later.',
			correlation_id: 'req-123',
		})
		expect(JSON.stringify(ctx.body)).not.toContain('implementation detail')
	})
})
