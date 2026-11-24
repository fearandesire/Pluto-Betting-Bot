import { describe, expect, it, vi } from 'vitest'

vi.mock('../../../utils/logging/WinstonLogger.js', () => ({
	createLogger: () => ({ warn: vi.fn(), info: vi.fn(), error: vi.fn() }),
}))

import { isEventLoopLagAlarming } from '../event-loop-monitor.js'

describe('isEventLoopLagAlarming', () => {
	it('stays quiet when the p99 delay is at or under the threshold', () => {
		expect(
			isEventLoopLagAlarming({ p50Ms: 5, p99Ms: 200, maxMs: 900 }, 200),
		).toBe(false)
	})

	it('alarms when the p99 delay exceeds the threshold, whatever the max', () => {
		expect(
			isEventLoopLagAlarming({ p50Ms: 5, p99Ms: 201, maxMs: 201 }, 200),
		).toBe(true)
	})
})
