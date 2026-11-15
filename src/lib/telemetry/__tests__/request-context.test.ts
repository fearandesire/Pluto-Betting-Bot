import { describe, expect, it } from 'vitest'
import {
	currentJobId,
	currentRequestId,
	REQUEST_ID_HEADER,
	runWithRequestId,
	withJobRequestId,
	withRequestIdHeader,
} from '../request-context.js'

type TestJob = { id?: string; upstream?: string }
const inJob = <R>(fn: () => Promise<R>, upstream?: string) =>
	withJobRequestId(
		async (_job: TestJob) => fn(),
		(job) => job.upstream,
	)({ id: 'job-1', upstream })

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

	it('sends the upstream run id inside a job that carries one', async () => {
		const init = await inJob(async () => withRequestIdHeader(), 'cron-x')
		expect(new Headers(init.headers).get(REQUEST_ID_HEADER)).toBe('cron-x')
	})

	it('falls back to the job id without an upstream id', async () => {
		const init = await inJob(async () => withRequestIdHeader())
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
		}, undefined)({ id: 'delivery-1' })
		expect(seen).toBe('delivery-1')
		expect(currentRequestId()).toBeUndefined()
	})

	it('uses the upstream run id as requestId and keeps the job id apart', async () => {
		expect(await inJob(async () => currentRequestId(), 'cron-x')).toBe(
			'cron-x',
		)
		expect(await inJob(async () => currentJobId(), 'cron-x')).toBe('job-1')
		expect(await inJob(async () => currentRequestId())).toBe('job-1')
		expect(currentJobId()).toBeUndefined()
	})

	it('generates an id for a job without one', async () => {
		const seen = await withJobRequestId(
			async (_job: { id?: string }) => currentRequestId(),
			undefined,
		)({})
		expect(seen).toMatch(UUID)
	})
})
