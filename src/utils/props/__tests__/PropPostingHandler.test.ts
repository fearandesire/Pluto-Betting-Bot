import type { ProcessedPropDto } from '@pluto-khronos/api-client'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
	exists: vi.fn(),
	set: vi.fn(),
	setex: vi.fn(),
	del: vi.fn(),
	sendToChannel: vi.fn(),
	sendToPredictionChannel: vi.fn(),
	getTeamInfo: vi.fn(),
	logger: { error: vi.fn(), warn: vi.fn() },
}))

vi.mock('../../api/Khronos/guild/guild-wrapper.js', () => ({
	default: vi.fn().mockImplementation(function () {
		return {
			sendToChannel: mocks.sendToChannel,
			sendToPredictionChannel: mocks.sendToPredictionChannel,
		}
	}),
}))

vi.mock('../../common/TeamInfo.js', () => ({
	default: vi.fn().mockImplementation(function () {
		return { getTeamInfo: mocks.getTeamInfo }
	}),
}))

vi.mock('../../cache/redis-instance.js', () => ({
	default: {
		exists: mocks.exists,
		set: mocks.set,
		setex: mocks.setex,
		del: mocks.del,
	},
}))

vi.mock('../../logging/WinstonLogger.js', () => ({ logger: mocks.logger }))

const { PropPostingHandler } = await import('../PropPostingHandler.js')

const prop = {
	event_id: 'event-1',
	commence_time: '2026-07-11T00:00:00Z',
	home_team: 'Home',
	away_team: 'Away',
	sport_title: 'NBA',
	market_key: 'player_points',
	bookmaker_key: 'draftkings',
	description: 'Player',
	point: 20.5,
	over: {
		outcome_uuid: '550e8400-e29b-41d4-a716-446655440000',
		outcome_name: 'Over',
		price: -110,
	},
	under: {
		outcome_uuid: '550e8400-e29b-41d4-a716-446655440001',
		outcome_name: 'Under',
		price: -110,
	},
} as ProcessedPropDto

describe('PropPostingHandler delivery idempotency', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mocks.exists.mockResolvedValue(0)
		mocks.set.mockResolvedValue('OK')
		mocks.setex.mockResolvedValue('OK')
		mocks.del.mockResolvedValue(1)
		mocks.sendToChannel.mockResolvedValue(undefined)
		mocks.getTeamInfo.mockResolvedValue({
			color: 0x123456,
			resolvedTeamData: { abbrev: 'HOM' },
		})
	})

	it('does not repost a prop already delivered to the same destination', async () => {
		const handler = new PropPostingHandler()

		const first = await handler.postPropsToChannel(
			'guild-1',
			[prop],
			'nba',
			'channel-1',
		)
		mocks.exists.mockResolvedValue(1)
		const second = await handler.postPropsToChannel(
			'guild-1',
			[prop],
			'nba',
			'channel-1',
		)

		expect(first).toEqual({ posted: 1, filtered: 0, failed: 0, total: 1 })
		expect(second).toEqual({ posted: 0, filtered: 1, failed: 0, total: 1 })
		expect(mocks.sendToChannel).toHaveBeenCalledTimes(1)
	})

	it('releases the delivery lock when posting fails so a retry can proceed', async () => {
		const handler = new PropPostingHandler()
		mocks.sendToChannel.mockRejectedValueOnce(
			new Error('Discord unavailable'),
		)

		const result = await handler.postPropsToChannel(
			'guild-1',
			[prop],
			'nba',
			'channel-1',
		)

		expect(result).toEqual({ posted: 0, filtered: 0, failed: 1, total: 1 })
		expect(mocks.del).toHaveBeenCalledWith(
			'props:delivery:guild-1:channel-1:550e8400-e29b-41d4-a716-446655440000:550e8400-e29b-41d4-a716-446655440001:lock',
		)
	})

	it('does not report a retryable failure after Discord accepts but marker storage fails', async () => {
		const handler = new PropPostingHandler()
		mocks.setex.mockRejectedValue(new Error('Redis unavailable'))

		const result = await handler.postPropsToChannel(
			'guild-1',
			[prop],
			'nba',
			'channel-1',
		)

		expect(result).toEqual({ posted: 1, filtered: 0, failed: 0, total: 1 })
		expect(mocks.del).not.toHaveBeenCalled()
		expect(mocks.logger.error).toHaveBeenCalledWith(
			expect.objectContaining({
				event: 'props_delivery_marker_write_failed',
			}),
		)
	})
})
