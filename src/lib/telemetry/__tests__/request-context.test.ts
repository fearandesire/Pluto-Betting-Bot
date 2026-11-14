import { describe, expect, it } from 'vitest'
import {
	currentRequestId,
	REQUEST_ID_HEADER,
	runWithRequestId,
	withJobRequestId,
	withRequestIdHeader,
} from '../request-context.js'

const UUID =
	/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

describe('withRequestIdHeader', () => {
	it('sends the id of the interaction or request in progress', () => {
		const init = runWithRequestId('interaction-1', () =>
			withRequestIdHeader({ headers: { 'x-api-key': 'k' } }),
		)
		const headers = new Headers(init.headers)
		expect(headers.get(REQUEST_ID_HEADER)).toBe('interaction-1')
		expect(headers.get('x-api-key')).toBe('k')
	})

	it('prefers the upstream run id over the job id', () => {
		const init = runWithRequestId(
			'job-1',
			() => withRequestIdHeader(),
			'cron-x',
		)
		expect(new Headers(init.headers).get(REQUEST_ID_HEADER)).toBe('cron-x')
	})

	it('falls back to the job id without an upstream id', () => {
		const init = runWithRequestId('job-1', () => withRequestIdHeader())
		expect(new Headers(init.headers).get(REQUEST_ID_HEADER)).toBe('job-1')
	})

	it('generates an id when no context is active', () => {
		const headers = new Headers(withRequestIdHeader().headers)
		expect(headers.get(REQUEST_ID_HEADER)).toMatch(UUID)
	})

	it('keeps an id the caller already set', () => {
		const init = runWithRequestId('ctx', () =>
			withRequestIdHeader({ headers: { 'x-request-id': 'explicit' } }),
		)
		expect(new Headers(init.headers).get(REQUEST_ID_HEADER)).toBe(
			'explicit',
		)
	})

	it('keeps retry options and body on the init', () => {
		const init = withRequestIdHeader({
			body: 'b',
			retries: 2,
		} as RequestInit & {
			retries: number
		})
		expect(init).toMatchObject({ body: 'b', retries: 2 })
	})
})

describe('withJobRequestId', () => {
	it('scopes the processor and its awaits to the job id', async () => {
		const seen = await withJobRequestId(async (_job: { id?: string }) => {
			await new Promise((resolve) => setTimeout(resolve, 1))
			return currentRequestId()
		})({ id: 'delivery-1' })
		expect(seen).toBe('delivery-1')
		expect(currentRequestId()).toBeUndefined()
	})

	it('generates an id for a job without one', async () => {
		const seen = await withJobRequestId(async (_job: { id?: string }) =>
			currentRequestId(),
		)({})
		expect(seen).toMatch(UUID)
	})
})
