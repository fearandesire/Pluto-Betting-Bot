import { afterEach, describe, expect, it, vi } from 'vitest'
import { GatewayConnectivityMonitor } from '../failure-trackers.js'

describe('GatewayConnectivityMonitor', () => {
	afterEach(() => vi.useRealTimers())

	it('reports a sustained disconnect and resolves when the shard is ready', async () => {
		vi.useFakeTimers()
		const reporter = {
			firing: vi.fn().mockResolvedValue(undefined),
			resolved: vi.fn().mockResolvedValue(undefined),
		}
		const monitor = new GatewayConnectivityMonitor(reporter, 120_000)

		monitor.disconnected('3')
		await vi.advanceTimersByTimeAsync(119_999)
		expect(reporter.firing).not.toHaveBeenCalled()
		await vi.advanceTimersByTimeAsync(1)
		expect(reporter.firing).toHaveBeenCalledOnce()

		await monitor.ready('3')
		expect(reporter.resolved).toHaveBeenCalledOnce()
	})
})
