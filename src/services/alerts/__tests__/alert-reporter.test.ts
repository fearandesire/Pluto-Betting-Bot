import { describe, expect, it, vi } from 'vitest'
import { type AlertIncidentStore, AlertReporter } from '../alert-reporter.js'

const observation = {
	key: 'delivery.failed' as const,
	scope: 'notification-queue',
	severity: 'warning' as const,
	title: 'Notification delivery failed',
	summary: 'A notification delivery job requires operator attention.',
	retriable: false,
	observedAt: new Date('2026-09-12T20:00:00.000Z'),
	context: { attempt_count: 8 },
}

describe('AlertReporter', () => {
	it('emits one contract event for a firing transition and suppresses repeats', async () => {
		const store: AlertIncidentStore = {
			recordFiring: vi
				.fn()
				.mockResolvedValueOnce({
					state: 'firing',
					firstFiredAt: observation.observedAt,
					suppressedCount: 0,
					emit: true,
				})
				.mockResolvedValueOnce({
					state: 'firing',
					firstFiredAt: observation.observedAt,
					suppressedCount: 1,
					emit: false,
				}),
			resolve: vi.fn(),
		}
		const logger = { info: vi.fn(), warn: vi.fn() }
		const reporter = new AlertReporter(store, logger, {
			version: '4.6.9',
			environment: 'staging',
		})

		await reporter.firing(observation)
		await reporter.firing({
			...observation,
			observedAt: new Date('2026-09-12T20:01:00.000Z'),
		})

		expect(store.recordFiring).toHaveBeenCalledTimes(2)
		expect(logger.info).toHaveBeenCalledOnce()
		expect(logger.info.mock.calls[0][0]).toEqual(
			expect.objectContaining({
				event: 'alert.transition',
				alert_event: expect.objectContaining({
					key: 'delivery.failed',
					state: 'firing',
					fingerprint: 'pluto:delivery.failed:notification-queue',
				}),
			}),
		)
	})

	it('emits recovery with the original severity and same fingerprint', async () => {
		const store: AlertIncidentStore = {
			recordFiring: vi.fn(),
			resolve: vi.fn().mockResolvedValue({
				state: 'resolved',
				firstFiredAt: observation.observedAt,
				resolvedAt: new Date('2026-09-12T20:05:00.000Z'),
				emit: true,
			}),
		}
		const logger = { info: vi.fn(), warn: vi.fn() }
		const reporter = new AlertReporter(store, logger, {
			version: '4.6.9',
			environment: 'production',
		})

		await reporter.resolved({
			...observation,
			resolvedAt: new Date('2026-09-12T20:05:00.000Z'),
		})

		expect(logger.info.mock.calls[0][0]).toEqual(
			expect.objectContaining({
				alert_event: expect.objectContaining({
					state: 'resolved',
					severity: 'warning',
					key: 'delivery.failed',
				}),
			}),
		)
	})
})
