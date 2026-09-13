import { describe, expect, it, vi } from 'vitest'
import { ConsecutiveFailureTracker } from '../failure-trackers.js'

describe('Discord rate-limit alerts', () => {
	it('fires at the configured threshold and preserves the warning severity', async () => {
		const reporter = {
			firing: vi.fn().mockResolvedValue(undefined),
			resolved: vi.fn().mockResolvedValue(undefined),
		}
		const tracker = new ConsecutiveFailureTracker(reporter, {
			key: 'discord.rate_limited',
			scope: 'notification-delivery',
			severity: 'warning',
			title: 'Discord delivery is rate limited',
			summary: 'Discord delivery is temporarily rate limited.',
			threshold: 3,
		})

		await tracker.failure()
		await tracker.failure()
		await tracker.failure()

		expect(reporter.firing).toHaveBeenCalledWith(
			expect.objectContaining({
				key: 'discord.rate_limited',
				severity: 'warning',
			}),
		)
	})
})
