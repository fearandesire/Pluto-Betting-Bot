import { describe, expect, it, vi } from 'vitest'
import { ConsecutiveFailureTracker } from '../failure-trackers.js'

describe('Khronos connectivity alerts', () => {
	it('fires after five logical failures and resolves on success', async () => {
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

		for (let attempt = 0; attempt < 5; attempt++) await tracker.failure()
		await tracker.success()

		expect(reporter.firing).toHaveBeenCalledOnce()
		expect(reporter.resolved).toHaveBeenCalledOnce()
	})
})
