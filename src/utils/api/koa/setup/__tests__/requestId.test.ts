import type { Context } from 'koa'
import { describe, expect, it } from 'vitest'
import { currentRequestId } from '../../../../../lib/telemetry/request-context.js'
import { createRequestIdMiddleware } from '../requestId.js'

const fakeCtx = (headers: Record<string, string>) => {
	const response: Record<string, string> = {}
	return {
		state: {} as Record<string, unknown>,
		get: (name: string) => headers[name.toLowerCase()] ?? '',
		set: (name: string, value: string) => {
			response[name] = value
		},
		response,
	}
}

describe('createRequestIdMiddleware', () => {
	it('runs downstream middleware inside the inbound X-Request-ID', async () => {
		const ctx = fakeCtx({ 'x-request-id': 'delivery-1' })
		let seen: string | undefined
		await createRequestIdMiddleware()(
			ctx as unknown as Context,
			async () => {
				await new Promise((resolve) => setTimeout(resolve, 1))
				seen = currentRequestId()
			},
		)
		expect(seen).toBe('delivery-1')
		expect(ctx.state.reqId).toBe('delivery-1')
	})

	it('generates an id and uses it for the context and response', async () => {
		const ctx = fakeCtx({})
		let seen: string | undefined
		await createRequestIdMiddleware()(
			ctx as unknown as Context,
			async () => {
				seen = currentRequestId()
			},
		)
		expect(seen).toBe(ctx.state.reqId)
		expect(ctx.response.reqId).toBe(ctx.state.reqId)
	})
})
