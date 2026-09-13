import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BetsCacheService } from '../../../utils/api/common/bets/BetsCacheService.js'

describe('H2H placement identity', () => {
	const set = vi.fn()
	const get = vi.fn()
	const remove = vi.fn()
	let service: BetsCacheService

	beforeEach(() => {
		vi.clearAllMocks()
		service = new BetsCacheService({ set, get, remove } as never)
	})

	it('retains one generated placement id through cache and API sanitization', async () => {
		await service.cacheUserBet('user-1', {
			userid: 'user-1',
			team: 'Lakers',
			amount: 80,
			match: { id: 'event-1' },
			opponent: 'Celtics',
			dateofmatchup: '2026-09-14T00:00:00.000Z',
			profit: 120,
			payout: 200,
			guild_id: 'guild-1',
		} as never)

		const cached = set.mock.calls[0]?.[1]
		expect(cached.placement_id).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
		)

		const sanitized = await service.sanitize(cached)
		expect(sanitized).toMatchObject({
			placement_id: cached.placement_id,
			event_id: 'event-1',
		})
	})
})
