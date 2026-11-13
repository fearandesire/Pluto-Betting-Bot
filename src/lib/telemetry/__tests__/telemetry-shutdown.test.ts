import { describe, expect, it, vi } from 'vitest'

const load = async () => {
	vi.resetModules()
	return import('../telemetry-shutdown.js')
}

describe('flushTelemetry', () => {
	it('resolves at once when tracing never registered a flush', async () => {
		const { flushTelemetry } = await load()
		await expect(flushTelemetry(10)).resolves.toBeUndefined()
	})

	it('waits for the registered SDK shutdown', async () => {
		const { flushTelemetry, registerTelemetryFlush } = await load()
		const done = vi.fn()
		registerTelemetryFlush(async () => {
			await new Promise((resolve) => setTimeout(resolve, 5))
			done()
		})
		await flushTelemetry(1_000)
		expect(done).toHaveBeenCalledOnce()
	})

	it('gives up after the timeout and never rejects', async () => {
		const { flushTelemetry, registerTelemetryFlush } = await load()
		registerTelemetryFlush(() => new Promise<void>(() => undefined))
		const started = Date.now()
		await flushTelemetry(20)
		expect(Date.now() - started).toBeLessThan(1_000)

		registerTelemetryFlush(async () => {
			throw new Error('exporter down')
		})
		await expect(flushTelemetry(20)).resolves.toBeUndefined()
	})
})
