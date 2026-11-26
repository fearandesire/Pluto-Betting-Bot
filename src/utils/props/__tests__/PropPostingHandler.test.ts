import type { ProcessedPropDto } from '@pluto-khronos/api-client'
import { MessageFlags } from 'discord.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { toJsonComponents } from '../../../lib/discord/v2/__tests__/v2-assert.js'

const mocks = vi.hoisted(() => ({
	get: vi.fn(),
	set: vi.fn(),
	setex: vi.fn(),
	del: vi.fn(),
	transitionIfValue: vi.fn(),
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
		transitionIfValue: mocks.transitionIfValue,
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
const deliveryKey =
	'props:delivery:guild-1:channel-1:550e8400-e29b-41d4-a716-446655440000:550e8400-e29b-41d4-a716-446655440001'
const references = [
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
]

describe('PropPostingHandler message references and idempotency', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mocks.get.mockResolvedValue(null)
		mocks.set.mockResolvedValue('OK')
		mocks.setex.mockResolvedValue('OK')
		mocks.transitionIfValue.mockResolvedValue(true)
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
		expect(result.results).toEqual(references)
		expect(mocks.sendToChannel).toHaveBeenCalledWith(
			'channel-1',
			expect.objectContaining({ embeds: expect.any(Array) }),
			'guild-1',
		)
	})

	it('uses a deterministic Discord nonce for durable prop-post retries', async () => {
		const result = await new PropPostingHandler().postPropPair(
			'guild-1',
			'channel-1',
			prop,
			'nba',
			'550e8400-e29b-41d4-a716-446655440010',
			'prop-post:guild-1:channel-1:550e8400-e29b-41d4-a716-446655440000:550e8400-e29b-41d4-a716-446655440001',
		)

		expect(result).toEqual(references)
		const firstOptions = mocks.sendToChannel.mock.calls[0][1]
		expect(firstOptions).toMatchObject({
			enforceNonce: true,
			nonce: expect.stringMatching(/^[0-9a-f]{25}$/),
		})
		mocks.sendToChannel.mockClear()
		await new PropPostingHandler().postPropPair(
			'guild-1',
			'channel-1',
			prop,
			'nba',
			'550e8400-e29b-41d4-a716-446655440010',
			'prop-post:guild-1:channel-1:550e8400-e29b-41d4-a716-446655440000:550e8400-e29b-41d4-a716-446655440001',
		)
		expect(mocks.sendToChannel.mock.calls[0][1].nonce).toBe(
			firstOptions.nonce,
		)
	})

	it('does not repost a prop already delivered to the same destination', async () => {
		const handler = new PropPostingHandler()

		const first = await handler.postPropsToChannel(
			'guild-1',
			[prop],
			'nba',
			'channel-1',
		)
		mocks.get.mockResolvedValue('sent')
		const second = await handler.postPropsToChannel(
			'guild-1',
			[prop],
			'nba',
			'channel-1',
		)

		expect(first.posted).toBe(1)
		expect(first.results).toEqual(references)
		expect(second).toMatchObject({
			posted: 0,
			filtered: 1,
			failed: 0,
			total: 1,
		})
		expect(second.results).toEqual([])
		expect(mocks.sendToChannel).toHaveBeenCalledTimes(1)
	})

	it('recovers durable outcome references for a sent pair', async () => {
		mocks.get.mockResolvedValue(
			JSON.stringify({ status: 'sent', results: references }),
		)

		const result = await new PropPostingHandler().postPropsToChannel(
			'guild-1',
			[prop],
			'nba',
			'channel-1',
		)

		expect(result).toMatchObject({ posted: 1, filtered: 0, failed: 0 })
		expect(result.results).toEqual(references)
		expect(mocks.sendToChannel).not.toHaveBeenCalled()
	})

	it('fails closed on an unknown legacy marker instead of reposting', async () => {
		mocks.get.mockResolvedValue(JSON.stringify({ status: 'complete' }))

		const result = await new PropPostingHandler().postPropsToChannel(
			'guild-1',
			[prop],
			'nba',
			'channel-1',
		)

		expect(result).toMatchObject({ posted: 0, failed: 1, filtered: 0 })
		expect(result.failures[0]?.error).toMatch(
			/unknown legacy delivery marker/i,
		)
		expect(mocks.sendToChannel).not.toHaveBeenCalled()
	})

	it('records an in-flight claim as a retryable failure and allows a later retry', async () => {
		const handler = new PropPostingHandler()
		mocks.get.mockResolvedValueOnce('processing')

		const inFlight = await handler.postPropsToChannel(
			'guild-1',
			[prop],
			'nba',
			'channel-1',
		)
		mocks.get.mockResolvedValueOnce(null)
		const retry = await handler.postPropsToChannel(
			'guild-1',
			[prop],
			'nba',
			'channel-1',
		)

		expect(inFlight).toMatchObject({
			posted: 0,
			filtered: 0,
			failed: 1,
			total: 1,
		})
		expect(inFlight.failures).toEqual([
			expect.objectContaining({
				guild_id: 'guild-1',
				channel_id: 'channel-1',
				error: 'Delivery is already being processed; retry later',
			}),
		])
		expect(retry.posted).toBe(1)
		expect(retry.results).toEqual(references)
		expect(mocks.sendToChannel).toHaveBeenCalledTimes(1)
	})

	it('reclaims a retry marker with an atomic Redis transition', async () => {
		mocks.get.mockResolvedValueOnce('retry')

		const result = await new PropPostingHandler().postPropsToChannel(
			'guild-1',
			[prop],
			'nba',
			'channel-1',
		)

		expect(result.posted).toBe(1)
		expect(result.results).toEqual(references)
		expect(mocks.transitionIfValue).toHaveBeenCalledWith(
			deliveryKey,
			'retry',
			'processing',
			7 * 24 * 60 * 60,
		)
	})

	it('does not send when a durable delivery claim cannot be created', async () => {
		const handler = new PropPostingHandler()
		mocks.set.mockRejectedValueOnce(new Error('Redis unavailable'))

		const result = await handler.postPropsToChannel(
			'guild-1',
			[prop],
			'nba',
			'channel-1',
		)
		mocks.set.mockResolvedValue('OK')
		const retry = await handler.postPropsToChannel(
			'guild-1',
			[prop],
			'nba',
			'channel-1',
		)

		expect(result).toMatchObject({
			posted: 0,
			filtered: 0,
			failed: 1,
			total: 1,
		})
		expect(retry.posted).toBe(1)
		expect(retry.results).toEqual(references)
		expect(mocks.sendToChannel).toHaveBeenCalledTimes(1)
		expect(mocks.logger.warn).toHaveBeenCalledWith(
			expect.objectContaining({
				event: 'props_delivery_idempotency_unavailable',
			}),
		)
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
		expect(mocks.del).toHaveBeenCalledWith(deliveryKey)
	})

	it('shortens a failed claim when Redis release fails', async () => {
		mocks.sendToChannel.mockRejectedValueOnce(
			new Error('Discord unavailable'),
		)
		mocks.del.mockRejectedValueOnce(new Error('Redis unavailable'))

		await new PropPostingHandler().postPropsToChannel(
			'guild-1',
			[prop],
			'nba',
			'channel-1',
		)

		expect(mocks.setex).toHaveBeenLastCalledWith(
			deliveryKey,
			5,
			'processing',
		)
	})

	it('persists a sent ledger with plain SET when SETEX fails', async () => {
		mocks.set.mockReset()
		mocks.set.mockResolvedValueOnce('OK').mockResolvedValueOnce('OK')
		mocks.setex.mockRejectedValueOnce(
			new Error('Redis command unavailable'),
		)

		await new PropPostingHandler().postPropsToChannel(
			'guild-1',
			[prop],
			'nba',
			'channel-1',
		)

		expect(mocks.set).toHaveBeenLastCalledWith(
			deliveryKey,
			expect.stringContaining('"status":"sent"'),
		)
	})

	it('leaves a retry marker when claim release commands fail', async () => {
		mocks.sendToChannel.mockRejectedValueOnce(
			new Error('Discord unavailable'),
		)
		mocks.del.mockRejectedValueOnce(new Error('Redis unavailable'))
		mocks.setex.mockRejectedValueOnce(new Error('Redis unavailable'))

		await new PropPostingHandler().postPropsToChannel(
			'guild-1',
			[prop],
			'nba',
			'channel-1',
		)

		expect(mocks.set).toHaveBeenLastCalledWith(deliveryKey, 'retry')
	})

	it('reports a marker persistence failure after Discord accepts the message', async () => {
		mocks.set.mockReset()
		mocks.set
			.mockResolvedValueOnce('OK')
			.mockRejectedValueOnce(new Error('Redis unavailable'))
		mocks.setex.mockRejectedValueOnce(new Error('Redis unavailable'))

		const result = await new PropPostingHandler().postPropsToChannel(
			'guild-1',
			[prop],
			'nba',
			'channel-1',
		)

		expect(result).toMatchObject({
			posted: 0,
			filtered: 0,
			failed: 1,
			total: 1,
		})
		expect(result.results).toEqual([])
		expect(result.failures).toEqual([
			expect.objectContaining({
				guild_id: 'guild-1',
				channel_id: 'channel-1',
				outcome_uuids: [
					prop.over.outcome_uuid,
					prop.under.outcome_uuid,
				],
				error: 'Discord message posted but durable delivery marker was unavailable',
			}),
		])
		expect(mocks.sendToChannel).toHaveBeenCalledTimes(1)
		expect(mocks.del).not.toHaveBeenCalled()
	})
	describe('postPropBoard', () => {
		const second = {
			...prop,
			description: 'Second Player',
			over: {
				...prop.over,
				outcome_uuid: '550e8400-e29b-41d4-a716-446655440002',
			},
			under: {
				...prop.under,
				outcome_uuid: '550e8400-e29b-41d4-a716-446655440003',
			},
		} as ProcessedPropDto
		const props = [prop, second]

		function buttonIds(options: unknown): string[] {
			const payload = options as { components: unknown }
			return toJsonComponents(payload as never)
				.flatMap((container) => container.components ?? [])
				.flatMap((row) => row.components ?? [])
				.map((button) => (button as { custom_id?: string }).custom_id)
				.filter((id): id is string => Boolean(id))
		}

		it('posts one V2 board and returns a receipt per outcome on one message', async () => {
			const receipt = await new PropPostingHandler().postPropBoard(
				'guild-1',
				'channel-1',
				props,
				'nba',
				'delivery-1',
				'prop-board:guild-1:channel-1:0',
				props,
			)

			expect(receipt).toHaveLength(4)
			expect(new Set(receipt.map((ref) => ref.message_id))).toEqual(
				new Set(['message-1']),
			)
			const options = mocks.sendToChannel.mock.calls[0][1] as {
				flags: number
				embeds?: unknown
			}
			expect(options.flags).toBe(MessageFlags.IsComponentsV2)
			expect(options.embeds).toBeUndefined()
			expect(
				buttonIds(options).some((id) =>
					id.startsWith('props.browse.v1.'),
				),
			).toBe(true)
		})

		it('renders the game block and team emojis, and receipts every game outcome', async () => {
			mocks.getTeamInfo.mockImplementation(async (team: string) => ({
				color: 0x123456,
				resolvedTeamData: {
					abbrev: [team === prop.home_team ? 'OKC' : 'MIN'],
				},
				emoji:
					team === prop.home_team
						? 'Thunder'
						: { toString: () => '<:timberwolves:42>' },
			}))
			const game = {
				h2h: {
					away: {
						outcome_uuid: '660e8400-e29b-41d4-a716-446655440010',
						outcome_name: prop.away_team,
						price: 150,
					},
					home: {
						outcome_uuid: '660e8400-e29b-41d4-a716-446655440011',
						outcome_name: prop.home_team,
						price: -180,
					},
				},
			}

			const receipt = await new PropPostingHandler().postPropBoard(
				'guild-1',
				'channel-1',
				props,
				'nba',
				'delivery-1',
				'prop-board:guild-1:channel-1:0',
				props,
				game,
			)

			expect(receipt.map((ref) => ref.outcome_uuid)).toEqual([
				prop.over.outcome_uuid,
				prop.under.outcome_uuid,
				second.over.outcome_uuid,
				second.under.outcome_uuid,
				game.h2h.away.outcome_uuid,
				game.h2h.home.outcome_uuid,
			])
			const options = mocks.sendToChannel.mock.calls[0][1] as never
			expect(buttonIds(options)).toContain(
				`prop_${game.h2h.home.outcome_uuid}`,
			)
			const header = toJsonComponents(options)[0].components?.[1] as {
				content: string
			}
			expect(header.content).toMatch(
				/^### 🏀 <:timberwolves:42> MIN vs\. OKC\n/,
			)
		})

		it('caches the whole post list for Browse more before sending', async () => {
			await new PropPostingHandler().postPropBoard(
				'guild-1',
				'channel-1',
				props,
				'nba',
				'delivery-1',
				'prop-board:guild-1:channel-1:0',
				[...props, second],
			)

			expect(mocks.setex).toHaveBeenCalledWith(
				expect.stringMatching(/^props:browse:[a-f0-9]{16}$/),
				7 * 24 * 60 * 60,
				expect.stringContaining('Second Player'),
			)
			const options = mocks.sendToChannel.mock.calls[0][1] as unknown
			const ids = buttonIds(options)
			const browse = ids.find((id) => id.startsWith('props.browse.v1.'))
			expect(browse).toBeDefined()
			expect(ids).toContain('prop_' + prop.over.outcome_uuid)
		})

		it('shares one Browse more list across boards and guilds of a delivery', async () => {
			const handler = new PropPostingHandler()
			await handler.postPropBoard(
				'guild-1',
				'channel-1',
				props,
				'nba',
				'delivery-1',
				'prop-board:guild-1:channel-1:0',
				[...props, second],
			)
			await handler.postPropBoard(
				'guild-2',
				'channel-2',
				[second],
				'nba',
				'delivery-1',
				'prop-board:guild-2:channel-2:1',
				[...props, second],
			)

			const keys = new Set(mocks.setex.mock.calls.map((call) => call[0]))
			expect(keys.size).toBe(1)
			const [first, other] = mocks.sendToChannel.mock.calls.map((call) =>
				buttonIds(call[1]).find((id) =>
					id.startsWith('props.browse.v1.'),
				),
			)
			expect(first).toBeDefined()
			expect(first).toBe(other)
		})

		it('keeps separate lists for different deliveries', async () => {
			const handler = new PropPostingHandler()
			for (const deliveryId of ['delivery-1', 'delivery-2'])
				await handler.postPropBoard(
					'guild-1',
					'channel-1',
					props,
					'nba',
					deliveryId,
					'prop-board:guild-1:channel-1:0',
					props,
				)
			expect(
				new Set(mocks.setex.mock.calls.map((call) => call[0])).size,
			).toBe(2)
		})

		it('still posts the board without Browse more when the cache is down', async () => {
			mocks.setex.mockRejectedValueOnce(new Error('redis down'))

			const receipt = await new PropPostingHandler().postPropBoard(
				'guild-1',
				'channel-1',
				props,
				'nba',
				'delivery-1',
				'prop-board:guild-1:channel-1:0',
				props,
			)

			expect(receipt).toHaveLength(4)
			const ids = buttonIds(mocks.sendToChannel.mock.calls[0][1])
			expect(ids.some((id) => id.startsWith('props.browse.v1.'))).toBe(
				false,
			)
			expect(mocks.logger.warn).toHaveBeenCalledWith(
				expect.objectContaining({
					event: 'props.browse.cache_write_failed',
				}),
			)
		})
	})
})
