import type { ProcessedPropDto } from '@pluto-khronos/api-client'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
	get: vi.fn(),
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
		get: mocks.get,
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

const sentMessage = { id: 'message-1', channelId: 'channel-1' }

describe('PropPostingHandler message references and idempotency', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mocks.get.mockResolvedValue(null)
		mocks.set.mockResolvedValue('OK')
		mocks.setex.mockResolvedValue('OK')
		mocks.del.mockResolvedValue(1)
		mocks.sendToChannel.mockResolvedValue(sentMessage)
		mocks.sendToPredictionChannel.mockResolvedValue(sentMessage)
		mocks.getTeamInfo.mockResolvedValue({
			color: 0x123456,
			resolvedTeamData: { abbrev: 'HOM' },
		})
	})

	it('returns both outcome refs for one posted Discord message', async () => {
		const result = await new PropPostingHandler().postPropsToChannel(
			'guild-1',
			[prop],
			'nba',
			'channel-1',
		)

		expect(result).toMatchObject({
			posted: 1,
			filtered: 0,
			failed: 0,
			total: 1,
		})
		expect(result.results).toEqual([
			{
				outcome_uuid: prop.over.outcome_uuid,
				guild_id: 'guild-1',
				channel_id: 'channel-1',
				message_id: 'message-1',
			},
			{
				outcome_uuid: prop.under.outcome_uuid,
				guild_id: 'guild-1',
				channel_id: 'channel-1',
				message_id: 'message-1',
			},
		])
		expect(mocks.sendToChannel).toHaveBeenCalledWith(
			'channel-1',
			expect.objectContaining({ embeds: expect.any(Array) }),
		)
	})

	it('does not repost a sent pair', async () => {
		const handler = new PropPostingHandler()
		await handler.postPropsToChannel('guild-1', [prop], 'nba', 'channel-1')
		mocks.get.mockResolvedValue('sent')

		const result = await handler.postPropsToChannel(
			'guild-1',
			[prop],
			'nba',
			'channel-1',
		)

		expect(result.posted).toBe(0)
		expect(result.filtered).toBe(1)
		expect(result.results).toEqual([])
		expect(mocks.sendToChannel).toHaveBeenCalledTimes(1)
	})

	it('keeps partial failures explicit and releases failed claims', async () => {
		mocks.sendToChannel.mockRejectedValueOnce(
			new Error('Discord unavailable'),
		)

		const result = await new PropPostingHandler().postPropsToChannel(
			'guild-1',
			[prop],
			'nba',
			'channel-1',
		)

		expect(result).toMatchObject({ posted: 0, filtered: 0, failed: 1 })
		expect(result.failures).toEqual([
			expect.objectContaining({
				guild_id: 'guild-1',
				channel_id: 'channel-1',
				outcome_uuids: [
					prop.over.outcome_uuid,
					prop.under.outcome_uuid,
				],
				error: 'Discord unavailable',
			}),
		])
		expect(mocks.del).toHaveBeenCalledWith(
			'props:delivery:guild-1:channel-1:550e8400-e29b-41d4-a716-446655440000:550e8400-e29b-41d4-a716-446655440001',
		)
	})
})
