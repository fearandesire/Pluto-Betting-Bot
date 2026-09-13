import { describe, expect, it, vi } from 'vitest'
import { ConsecutiveFailureTracker } from '../failure-trackers.js'

describe('ConsecutiveFailureTracker', () => {
	it('fires at the threshold and resolves after a successful operation', async () => {
		const reporter = {
			firing: vi.fn().mockResolvedValue(undefined),
			resolved: vi.fn().mockResolvedValue(undefined),
		}
		const tracker = new ConsecutiveFailureTracker(reporter, {
			key: 'khronos.unreachable',
			scope: 'api',
			severity: 'critical',
			title: 'Khronos is unreachable',
			summary: 'Pluto cannot reach the scheduling service.',
			threshold: 5,
		})

		for (let count = 0; count < 4; count++) await tracker.failure()
		expect(reporter.firing).not.toHaveBeenCalled()
		await tracker.failure()
		await tracker.failure()
		expect(reporter.firing).toHaveBeenCalledOnce()

		await tracker.success()
		expect(reporter.resolved).toHaveBeenCalledOnce()
	})

	it('resolves on the first success after a restart', async () => {
		const reporter = {
			firing: vi.fn().mockResolvedValue(undefined),
			resolved: vi.fn().mockResolvedValue(undefined),
		}
		const tracker = new ConsecutiveFailureTracker(reporter, {
			key: 'khronos.unreachable',
			scope: 'api',
			severity: 'critical',
			title: 'Khronos is unreachable',
			summary: 'Pluto cannot reach the scheduling service.',
			threshold: 5,
		})

		await tracker.success()

		expect(reporter.resolved).toHaveBeenCalledOnce()
	})

	it('does not suppress a later firing when the reporter rejects', async () => {
		const reporter = {
			firing: vi
				.fn()
				.mockRejectedValueOnce(new Error('redis unavailable'))
				.mockResolvedValue(undefined),
			resolved: vi.fn().mockResolvedValue(undefined),
		}
		const tracker = new ConsecutiveFailureTracker(reporter, {
			key: 'discord.rate_limited',
			scope: 'delivery',
			severity: 'warning',
			title: 'Discord delivery is rate limited',
			summary: 'Discord delivery is temporarily rate limited.',
			threshold: 1,
		})

		await tracker.failure()
		await tracker.failure()

		expect(reporter.firing).toHaveBeenCalledTimes(2)
	})
})

describe('GatewayConnectivityMonitor', () => {
	it('resolves a pending firing before resolving the incident', async () => {
		vi.useFakeTimers()
		const order: string[] = []
		const reporter = {
			firing: vi.fn(async () => {
				await Promise.resolve()
				order.push('firing')
			}),
			resolved: vi.fn(async () => {
				order.push('resolved')
			}),
		}
		const { GatewayConnectivityMonitor } = await import(
			'../failure-trackers.js'
		)
		const monitor = new GatewayConnectivityMonitor(reporter, 10)

		monitor.disconnected('2')
		vi.advanceTimersByTime(10)
		const ready = monitor.ready('2')
		await ready

		expect(order).toEqual(['firing', 'resolved'])
		vi.useRealTimers()
	})
})
