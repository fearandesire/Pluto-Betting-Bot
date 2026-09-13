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
})
