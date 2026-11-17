import { AxiosError } from 'axios'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

// Stub the environment and logger the real modules import at load time.
vi.mock('../../../../lib/startup/env.js', () => ({
	default: {
		KH_API_URL: 'https://khronos.example.invalid',
		KH_PLUTO_CLIENT_KEY: 'client-key',
		PROJECT_VERSION: 'test',
		USE_MOCK_DATA: false,
	},
}))
vi.mock('../../../../utils/logging/WinstonLogger.js', () => ({
	logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
	createLogger: () => ({
		warn: vi.fn(),
		info: vi.fn(),
		error: vi.fn(),
		debug: vi.fn(),
	}),
}))
// Retries are not under test here; a pass-through keeps the outcome immediate.
vi.mock('fetch-retry', () => ({
	default: (fetchImpl: typeof fetch) => fetchImpl,
}))
vi.mock('../../../../services/alerts/betting-ops-alert.js', () => ({
	reportBettingFailure: vi.fn(),
}))

import { reportBettingFailure } from '../../../../services/alerts/betting-ops-alert.js'
import { AxiosKhronosInstance } from '../../common/axios-config.js'

const alert = vi.mocked(reportBettingFailure)

const jsonResponse = (status: number) =>
	new Response(JSON.stringify({ message: 'x' }), {
		status,
		headers: { 'content-type': 'application/json' },
	})

// The generated client is created from KH_API_CONFIG, which captures fetch at load.
// Stub fetch first, then load the module, so the production hook is what runs.
const fetchMock = vi.fn(
	async (_input: RequestInfo | URL, _init?: RequestInit) => jsonResponse(200),
)
let KH_API_CONFIG: {
	fetchApi?: (
		input: RequestInfo | URL,
		init?: RequestInit,
	) => Promise<Response>
}
let BetslipWrapper: typeof import('../bets/betslip-wrapper.js').default

beforeAll(async () => {
	vi.stubGlobal('fetch', fetchMock)
	;({ KH_API_CONFIG } = await import('../KhronosInstances.js'))
	;({ default: BetslipWrapper } = await import('../bets/betslip-wrapper.js'))
})

beforeEach(() => {
	fetchMock.mockReset()
	alert.mockClear()
})

describe('betslip placement through the generated client (fetch hook)', () => {
	it('alerts when placement returns a 5xx after the client call', async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse(500))
		await expect(
			new BetslipWrapper().finalize({
				placeBetDto: { userid: 'u', amount: 1 },
			} as never),
		).rejects.toThrow()

		expect(alert).toHaveBeenCalledTimes(1)
		const [failure] = alert.mock.calls[0]!
		expect(failure.event).toBe('khronos.betting_unavailable')
		expect(failure.key).toBe(
			'khronos.betting_unavailable:betslips/place:server',
		)
		expect(String(failure.error)).toContain('500')
		expect(failure.requestId).toMatch(/\S/)
	})

	it('does not alert on a 4xx validation answer', async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse(400))
		await expect(
			new BetslipWrapper().finalize({
				placeBetDto: { userid: 'u', amount: 1 },
			} as never),
		).rejects.toThrow()
		expect(alert).not.toHaveBeenCalled()
	})

	it('alerts on a network failure with the betslip route', async () => {
		fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'))
		await expect(
			KH_API_CONFIG.fetchApi!(
				'https://khronos.example.invalid/betslips/create',
				{
					method: 'POST',
				},
			),
		).rejects.toThrow('fetch failed')

		expect(alert).toHaveBeenCalledTimes(1)
		expect(alert.mock.calls[0]![0].key).toBe(
			'khronos.betting_unavailable:betslips/create:network',
		)
	})

	it('alerts on a timeout', async () => {
		const timeout = Object.assign(new Error('The operation timed out.'), {
			name: 'TimeoutError',
		})
		fetchMock.mockRejectedValueOnce(timeout)
		await expect(
			KH_API_CONFIG.fetchApi!(
				'https://khronos.example.invalid/betslips/place',
				{
					method: 'POST',
				},
			),
		).rejects.toThrow()

		expect(alert.mock.calls[0]![0].key).toBe(
			'khronos.betting_unavailable:betslips/place:timeout',
		)
	})

	it('ignores non-betting routes', async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse(500))
		await KH_API_CONFIG.fetchApi!(
			'https://khronos.example.invalid/profile/1',
			{
				method: 'GET',
			},
		)
		expect(alert).not.toHaveBeenCalled()
	})
})

describe('parlay calls through the axios instance (response hook)', () => {
	// A custom adapter must settle like axios's own adapter: a non-2xx status throws.
	const respondWith =
		(status: number) => async (config: Record<string, unknown>) => {
			const response = {
				data: {},
				status,
				statusText: 'status',
				headers: {},
				config,
				request: {},
			}
			throw new AxiosError(
				`Request failed with status code ${status}`,
				'ERR_BAD_RESPONSE',
				config as never,
				null,
				response as never,
			)
		}

	it('alerts when /parlays/place returns a 5xx', async () => {
		await expect(
			AxiosKhronosInstance.post(
				'/parlays/place',
				{ init_token: 't', placement_id: 'p' },
				{ adapter: respondWith(500) as never },
			),
		).rejects.toBeInstanceOf(AxiosError)

		expect(alert).toHaveBeenCalledTimes(1)
		expect(alert.mock.calls[0]![0].key).toBe(
			'khronos.betting_unavailable:parlays/place:server',
		)
	})

	it('alerts on an axios timeout (ECONNABORTED) on /parlays/init', async () => {
		const adapter = async (config: Record<string, unknown>) => {
			throw new AxiosError(
				'timeout of 1ms exceeded',
				'ECONNABORTED',
				config as never,
			)
		}
		await expect(
			AxiosKhronosInstance.post(
				'/parlays/init',
				{},
				{ adapter: adapter as never },
			),
		).rejects.toBeInstanceOf(AxiosError)

		expect(alert.mock.calls[0]![0].key).toBe(
			'khronos.betting_unavailable:parlays/init:timeout',
		)
	})

	it('does not alert on a 4xx answer', async () => {
		await expect(
			AxiosKhronosInstance.post(
				'/parlays/init',
				{},
				{ adapter: respondWith(400) as never },
			),
		).rejects.toBeInstanceOf(AxiosError)
		expect(alert).not.toHaveBeenCalled()
	})
})
