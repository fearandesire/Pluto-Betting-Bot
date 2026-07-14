import { describe, expect, it, vi } from 'vitest'

vi.mock('../../../lib/startup/env.js', () => ({
	default: {
		NODE_ENV: 'development',
		MOCK_GUILD_SPORT: 'nba',
		MOCK_GUILD_BETTING_CHAN_ID: '123456789012345678',
		DEV_GUILD_GAMES_CATEGORY_ID: '123456789012345678',
	},
}))

const { MockBackend } = await import('../mock-backend.js')

describe('MockBackend parlay lifecycle', () => {
	it('preserves spread and totals market metadata in mock parlays', () => {
		const backend = MockBackend.instance()
		backend.reset()
		const game = backend.seedGames('nba', 1).matches[0]
		if (!game?.id) throw new Error('mock game did not have an id')

		const preview = backend.initParlay({
			legs: [
				{
					event_id: game.id,
					outcome_uuid: `${game.id}-spread-home`,
				},
				{
					event_id: game.id,
					outcome_uuid: `${game.id}-total-over`,
				},
			],
			stake: 10,
			guild_id: 'guild-1',
			user_id: 'user-1',
		})

		expect(preview.legs.map((leg) => leg.market_key)).toEqual([
			'spreads',
			'totals',
		])
		expect(backend.placeParlay(preview.init_token).legs).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ market_key: 'spreads' }),
				expect.objectContaining({ market_key: 'totals' }),
			]),
		)
	})
})
