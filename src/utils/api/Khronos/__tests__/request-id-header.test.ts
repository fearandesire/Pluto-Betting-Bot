import type { InternalAxiosRequestConfig } from 'axios'
import { afterAll, describe, expect, it, vi } from 'vitest'

vi.mock('../../../../lib/startup/env.js', () => ({
	default: { KH_API_URL: 'http://khronos.test', KH_PLUTO_CLIENT_KEY: 'key' },
}))
vi.mock('../../../../services/alerts/alert-reporter.js', () => ({
	getDefaultAlertReporter: () => undefined,
}))

const fetchMock = vi.fn(
	async (_input: string, _init?: RequestInit) =>
		new Response('{}', { status: 200 }),
)
vi.stubGlobal('fetch', fetchMock)

const { KH_API_CONFIG } = await import('../KhronosInstances.js')
const { AxiosKhronosInstance } = await import('../../common/axios-config.js')
const { runWithRequestId } = await import(
	'../../../../lib/telemetry/request-context.js'
)

afterAll(() => vi.unstubAllGlobals())

const sentFetchHeaders = () => {
	const init = fetchMock.mock.lastCall?.[1] ?? {}
	return new Headers(init.headers)
}

const sendAxios = async () => {
	let sent: InternalAxiosRequestConfig | undefined
	await AxiosKhronosInstance.get('/ping', {
		adapter: async (config) => {
			sent = config
			return {
				data: {},
				status: 200,
				statusText: 'OK',
				headers: {},
				config,
			}
		},
	})
	return sent?.headers
}

describe('X-Request-ID on Khronos calls', () => {
	it('fetch client forwards the active request id with its own headers', async () => {
		await runWithRequestId('1234567890123456789', () =>
			KH_API_CONFIG.fetchApi?.('http://khronos.test/x', {
				headers: { ...KH_API_CONFIG.headers },
			}),
		)
		const headers = sentFetchHeaders()
		expect(headers.get('x-request-id')).toBe('1234567890123456789')
		expect(headers.get('x-api-key')).toBe('key')
	})

	it('fetch client generates an id outside any context', async () => {
		await KH_API_CONFIG.fetchApi?.('http://khronos.test/x', {})
		expect(sentFetchHeaders().get('x-request-id')).toMatch(
			/^[0-9a-f-]{36}$/,
		)
	})

	it('axios client forwards the active request id', async () => {
		const headers = await runWithRequestId('req-koa-1', sendAxios)
		expect(headers?.get('X-Request-ID')).toBe('req-koa-1')
	})

	it('axios client generates an id outside any context', async () => {
		const headers = await sendAxios()
		expect(String(headers?.get('X-Request-ID'))).toMatch(/^[0-9a-f-]{36}$/)
	})
})
