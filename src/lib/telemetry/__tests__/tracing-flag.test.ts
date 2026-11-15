import { afterEach, describe, expect, it, vi } from 'vitest'

const sdk = vi.hoisted(() => ({ loaded: vi.fn() }))
vi.mock('../otel-sdk.js', () => {
	sdk.loaded()
	return {}
})

afterEach(() => {
	vi.unstubAllEnvs()
	vi.resetModules()
	sdk.loaded.mockClear()
})

describe('PLUTO_OTEL_ENABLED', () => {
	it.each([undefined, 'false', '1', 'TRUE'])(
		'loads no SDK and no BullMQ telemetry when %s',
		async (value) => {
			if (value !== undefined) vi.stubEnv('PLUTO_OTEL_ENABLED', value)
			await import('../../../instrumentation.js')
			const { bullmqTelemetry } = await import('../bullmq-telemetry.js')
			expect(sdk.loaded).not.toHaveBeenCalled()
			expect(bullmqTelemetry()).toEqual({})
		},
	)

	it('starts the SDK and BullMQ telemetry when "true"', async () => {
		vi.stubEnv('PLUTO_OTEL_ENABLED', 'true')
		await import('../../../instrumentation.js')
		const { bullmqTelemetry } = await import('../bullmq-telemetry.js')
		expect(sdk.loaded).toHaveBeenCalledTimes(1)
		expect(bullmqTelemetry().telemetry).toBeDefined()
	})
})
