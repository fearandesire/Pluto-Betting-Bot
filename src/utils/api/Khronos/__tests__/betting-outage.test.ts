import { describe, expect, it, vi } from 'vitest'

vi.mock('../../../../utils/logging/WinstonLogger.js', () => ({
	logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}))
vi.mock('../../../../lib/startup/env.js', () => ({
	default: { BETTING_OPS_WEBHOOK_URL: undefined, PROJECT_VERSION: 'v0' },
}))

import { bettingRouteOf, classifyBettingOutage } from '../betting-outage.js'

describe('classifyBettingOutage', () => {
	it('treats a 5xx as a server outage', () => {
		expect(classifyBettingOutage({ status: 500 })).toBe('server')
		expect(classifyBettingOutage({ status: 503 })).toBe('server')
	})

	it('does not treat any status below 500 as an outage', () => {
		expect(classifyBettingOutage({ status: 200 })).toBeNull()
		expect(classifyBettingOutage({ status: 400 })).toBeNull()
		expect(classifyBettingOutage({ status: 429 })).toBeNull()
	})

	it('classifies a timeout by error name or axios code', () => {
		expect(
			classifyBettingOutage({
				error: Object.assign(new Error('t'), { name: 'TimeoutError' }),
			}),
		).toBe('timeout')
		expect(
			classifyBettingOutage({
				error: Object.assign(new Error('t'), { code: 'ECONNABORTED' }),
			}),
		).toBe('timeout')
	})

	it('classifies any other thrown error as a network failure', () => {
		expect(
			classifyBettingOutage({ error: new TypeError('fetch failed') }),
		).toBe('network')
	})
})

describe('bettingRouteOf', () => {
	it('reduces an absolute or relative betting URL to its first two segments', () => {
		expect(
			bettingRouteOf('https://khronos.example.invalid/betslips/place'),
		).toBe('betslips/place')
		expect(bettingRouteOf('/parlays/init')).toBe('parlays/init')
	})

	it('never includes ids in the route', () => {
		expect(
			bettingRouteOf(
				'https://khronos.example.invalid/parlays/b1886f89-52c7-45ed-a0ed-0f351e9ec938',
			),
		).toBeNull()
		expect(bettingRouteOf('/betslips/pending/12345')).toBe(
			'betslips/pending',
		)
	})

	it('returns null for non-betting routes', () => {
		expect(
			bettingRouteOf('https://khronos.example.invalid/profile/1'),
		).toBeNull()
	})
})
