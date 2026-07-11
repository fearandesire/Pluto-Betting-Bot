import { describe, expect, it, vi } from 'vitest'

const logger = vi.hoisted(() => ({
	error: vi.fn(),
	warn: vi.fn(),
	info: vi.fn(),
}))

vi.mock('../../../../logging/WinstonLogger.js', () => ({ logger }))

import { validateDailyPropsPayload } from '../../notifications/notification-utils.js'

describe('daily props validation', () => {
	it('returns an empty valid batch without treating it as malformed', () => {
		expect(validateDailyPropsPayload({ props: [], guilds: [] })).toEqual({
			props: [],
			guilds: [],
		})
	})
})
