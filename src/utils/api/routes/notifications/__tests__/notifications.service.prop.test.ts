import { EmbedBuilder, MessageFlags } from 'discord.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { RedisCacheClient } from '../../../../cache/redis-instance.js'

const mocks = vi.hoisted(() => ({
	fetchChannel: vi.fn(),
	redisSet: vi.fn(),
	redisDel: vi.fn(),
	redisCompareAndRemove: vi.fn(),
	redisRefreshIfOwned: vi.fn(),
	logger: {
		info: vi.fn(),
		error: vi.fn(),
		warn: vi.fn(),
		debug: vi.fn(),
	},
}))

vi.mock('@sapphire/framework', () => ({
	container: {
		client: {
			channels: {
				fetch: mocks.fetchChannel,
			},
		},
	},
}))

vi.mock('../../../../logging/WinstonLogger.js', () => ({
	logger: mocks.logger,
}))

vi.mock('../../../../cache/redis-instance.js', () => ({
	default: {
		set: mocks.redisSet,
		del: mocks.redisDel,
		compareAndRemove: mocks.redisCompareAndRemove,
		refreshIfOwned: mocks.redisRefreshIfOwned,
	},
}))

import { propBoardPayload } from '../../../../../lib/discord/builders/prop-board.js'
import { deliveryEnvelopeSchema } from '../delivery-contract.js'
import {
	type DeliveryDispatcher,
	type DeliveryQueuePort,
	NotificationDeliveryQueue,
} from '../delivery-queue.js'
import { RedisDeliveryStore } from '../delivery-store.js'
import NotificationService from '../notifications.service.js'

const payload = {
	outcome_uuid: '550e8400-e29b-41d4-a716-446655440000',
	result: 'won' as const,
	winning_side_display: 'Over',
	actual_value: 37,
	market_key: 'player_points',
	description: 'Stephen Curry',
	point: 35.5,
	tallies: { correct: 11, incorrect: 16, total: 27 },
	messages: [
		{
			guild_id: 'guild-1',
			channel_id: 'channel-1',
			message_id: 'message-1',
		},
	],
}

const voidPayload = {
	...payload,
	result: 'void' as const,
	winning_side_display: undefined,
	actual_value: null,
	tallies: { correct: 0, incorrect: 0, total: 2 },
	messages: [
		payload.messages[0],
		{
			guild_id: 'guild-1',
			channel_id: 'channel-1',
			message_id: 'message-2',
		},
	],
}

function createMessage() {
	const message = {
		embeds: [
			new EmbedBuilder().setTitle('🎯 Accuracy Challenge').addFields({
				name: 'Match',
				value: 'GSW vs LAL',
				inline: true,
			}),
		],
		components: [],
		flags: { has: () => false },
		edit: vi.fn(),
	} as any
	message.edit.mockImplementation(async (options: { embeds: unknown[] }) => {
		message.embeds = options.embeds.map((embed) =>
			EmbedBuilder.from(embed as never).toJSON(),
		)
		return message
	})
	return message
}

/** The service asks for a fresh message through FetchMessageOptions. */
function fetchId(arg: unknown): string {
	return typeof arg === 'string' ? arg : (arg as { message: string }).message
}

function fakeRedis(): RedisCacheClient {
	const values = new Map<string, string>()
	return {
		set: async (key, value, ...args) => {
			if (args.includes('NX') && values.has(key)) return null
			values.set(key, value)
			return 'OK'
		},
		get: async (key) => values.get(key) ?? null,
	} as unknown as RedisCacheClient
}

describe('NotificationService.processPropSettled', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mocks.redisSet.mockResolvedValue('OK')
		mocks.redisDel.mockResolvedValue(1)
		mocks.redisCompareAndRemove.mockResolvedValue(true)
		mocks.redisRefreshIfOwned.mockResolvedValue(true)
	})

	it('edits the original embed with result/tallies and removes stale buttons', async () => {
		const message = createMessage()
		const channel = {
			guildId: 'guild-1',
			isTextBased: () => true,
			messages: { fetch: vi.fn().mockResolvedValue(message) },
		}
		mocks.fetchChannel.mockResolvedValue(channel)

		await new NotificationService().processPropSettled(payload)

		expect(channel.messages.fetch).toHaveBeenCalledWith({
			message: 'message-1',
			force: true,
		})
		expect(message.edit).toHaveBeenCalledOnce()
		const edit = message.edit.mock.calls[0][0] as {
			embeds: Array<{
				toJSON: () => {
					fields?: Array<{ name: string; value: string }>
				}
			}>
			components: unknown[]
		}
		const fields = edit.embeds[0].toJSON().fields ?? []
		expect(fields).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					name: '🎯 Result',
					value: '**Result: Over ✅ — 37**',
				}),
				expect.objectContaining({
					name: '📊 Prediction results',
					value: '41% of 27 predictors got it right (11 correct, 16 incorrect).',
				}),
			]),
		)
		expect(edit.components).toEqual([])
	})

	it('deduplicates repeated message references and is idempotent on retry', async () => {
		const message = createMessage()
		const channel = {
			guildId: 'guild-1',
			isTextBased: () => true,
			messages: { fetch: vi.fn().mockResolvedValue(message) },
		}
		mocks.fetchChannel.mockResolvedValue(channel)

		const service = new NotificationService()
		await service.processPropSettled({
			...payload,
			messages: [payload.messages[0], payload.messages[0]],
		})
		await service.processPropSettled(payload)

		expect(channel.messages.fetch).toHaveBeenCalledTimes(2)
		expect(message.edit).toHaveBeenCalledTimes(2)
		const fields =
			(message.embeds[0] as { fields?: unknown[] }).fields ?? []
		expect(
			fields.filter(
				(field) => (field as { name?: string }).name === '🎯 Result',
			),
		).toHaveLength(1)
	})

	it('logs missing messages and continues without throwing', async () => {
		const channel = {
			guildId: 'guild-1',
			isTextBased: () => true,
			messages: {
				fetch: vi.fn().mockRejectedValue(new Error('Unknown Message')),
			},
		}
		mocks.fetchChannel.mockResolvedValue(channel)

		await expect(
			new NotificationService().processPropSettled(payload),
		).resolves.toBeUndefined()

		expect(channel.messages.fetch).toHaveBeenCalledWith({
			message: 'message-1',
			force: true,
		})
		expect(mocks.logger.warn).toHaveBeenCalledWith(
			expect.objectContaining({
				event: 'prop.notification.message_update_failed',
				message_id: 'message-1',
			}),
		)
	})

	it('renders a void settlement once on each ledger message', async () => {
		const messages = new Map([
			['message-1', createMessage()],
			['message-2', createMessage()],
		])
		const channel = {
			guildId: 'guild-1',
			isTextBased: () => true,
			messages: {
				fetch: vi.fn(async (arg: unknown) =>
					messages.get(fetchId(arg)),
				),
			},
		}
		mocks.fetchChannel.mockResolvedValue(channel)

		await new NotificationService().processPropSettled(voidPayload)

		expect(channel.messages.fetch).toHaveBeenCalledTimes(2)
		for (const message of messages.values()) {
			expect(message.edit).toHaveBeenCalledOnce()
			const edit = message.edit.mock.calls[0][0] as {
				embeds: Array<{
					toJSON: () => {
						fields?: Array<{ name: string; value: string }>
					}
				}>
				components: unknown[]
			}
			const fields = edit.embeds[0].toJSON().fields ?? []
			expect(fields).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						name: '🎯 Result',
						value: '**Result: Voided 🚫**',
					}),
					expect.objectContaining({
						name: '📊 Prediction results',
						value: '0% of 2 predictors got it right (0 correct, 0 incorrect).',
					}),
				]),
			)
			expect(edit.components).toEqual([])
		}
	})

	it('warns for a deleted message while editing the remaining void message', async () => {
		const survivingMessage = createMessage()
		const channel = {
			guildId: 'guild-1',
			isTextBased: () => true,
			messages: {
				fetch: vi.fn(async (arg: unknown) => {
					if (fetchId(arg) === 'message-1') {
						throw Object.assign(new Error('Unknown Message'), {
							code: 10008,
						})
					}
					return survivingMessage
				}),
			},
		}
		mocks.fetchChannel.mockResolvedValue(channel)

		await expect(
			new NotificationService().processPropSettled(voidPayload),
		).resolves.toBeUndefined()

		expect(survivingMessage.edit).toHaveBeenCalledOnce()
		expect(mocks.logger.warn).toHaveBeenCalledWith(
			expect.objectContaining({
				event: 'prop.notification.message_update_failed',
				message_id: 'message-1',
				error: 'Unknown Message',
			}),
		)
		expect(mocks.logger.error).not.toHaveBeenCalled()
	})

	it('reports a duplicate delivery without editing either void message twice', async () => {
		const envelope = deliveryEnvelopeSchema.parse({
			delivery_id: '550e8400-e29b-41d4-a716-446655440040',
			schema_version: 1,
			kind: 'prop_settled',
			occurred_at: '2026-09-17T20:00:00.000Z',
			payload: voidPayload,
		})
		if (envelope.kind !== 'prop_settled') {
			throw new Error('Expected prop settlement envelope')
		}
		const messages = new Map([
			['message-1', createMessage()],
			['message-2', createMessage()],
		])
		const channel = {
			guildId: 'guild-1',
			isTextBased: () => true,
			messages: {
				fetch: vi.fn(async (arg: unknown) =>
					messages.get(fetchId(arg)),
				),
			},
		}
		mocks.fetchChannel.mockResolvedValue(channel)
		const service = new NotificationService()
		const dispatcher: DeliveryDispatcher = {
			deliver: vi.fn(async (_envelope, destinationId) => {
				const reference = envelope.payload.messages.find((candidate) =>
					destinationId.endsWith(`:${candidate.message_id}`),
				)
				if (!reference)
					throw new Error(`Unknown destination ${destinationId}`)
				await service.deliverPropSettlementMessage(
					envelope.payload,
					reference,
				)
			}),
		}
		const queuePort = {
			add: vi.fn(async () => undefined),
			close: vi.fn(async () => undefined),
		} satisfies DeliveryQueuePort
		const queue = new NotificationDeliveryQueue({
			store: new RedisDeliveryStore(fakeRedis()),
			dispatcher,
			queue: queuePort,
			startWorker: false,
		})

		try {
			const first = await queue.acceptDetailed(envelope)
			expect(first.duplicate).toBe(false)
			await queue.processJob({ data: envelope } as never)

			const replay = await queue.acceptDetailed(envelope)

			expect(replay.duplicate).toBe(true)
			expect(replay.record.state).toBe('delivered')
			expect(queuePort.add).toHaveBeenCalledOnce()
			expect(dispatcher.deliver).toHaveBeenCalledTimes(2)
			for (const message of messages.values()) {
				expect(message.edit).toHaveBeenCalledOnce()
			}
		} finally {
			await queue.close()
		}
	})
	it('edits only the graded row of a V2 board and keeps the other rows', async () => {
		const boardProp = {
			commence_time: '2026-10-04T20:25:00Z',
			market_key: 'player_pass_yds',
			description: 'Patrick Mahomes',
			point: 274.5,
			over: { outcome_uuid: 'over-1', outcome_name: 'Over', price: -115 },
			under: {
				outcome_uuid: 'under-1',
				outcome_name: 'Under',
				price: 105,
			},
		}
		const second = {
			...boardProp,
			description: 'Josh Allen',
			market_key: 'player_pass_tds',
			point: 1.5,
			over: { outcome_uuid: 'over-2', outcome_name: 'Over', price: 120 },
			under: {
				outcome_uuid: 'under-2',
				outcome_name: 'Under',
				price: -140,
			},
		}
		const payloadV2 = propBoardPayload({
			props: [boardProp, second] as never,
			sport: 'nfl',
			teams: {
				homeAbbrev: ['KC'],
				awayAbbrev: ['BUF'],
				homeColor: 0xe31837,
			},
		})
		const message = {
			embeds: [],
			components: payloadV2.components,
			flags: { has: () => true },
			edit: vi.fn(),
		} as any
		message.edit.mockImplementation(
			async (options: { components: unknown[] }) => {
				message.components = options.components
				return message
			},
		)
		const channel = {
			guildId: 'guild-1',
			isTextBased: () => true,
			messages: { fetch: vi.fn().mockResolvedValue(message) },
		}
		mocks.fetchChannel.mockResolvedValue(channel)

		await new NotificationService().processPropSettled({
			...payload,
			outcome_uuid: 'under-2',
			result: 'lost',
			winning_side_display: 'Over',
			actual_value: 0,
		})

		expect(message.edit).toHaveBeenCalledOnce()
		const edit = message.edit.mock.calls[0][0] as {
			embeds?: unknown[]
			components: Array<{ components: Array<any> }>
		}
		expect(edit.embeds).toBeUndefined()
		expect((edit as { flags?: unknown }).flags).toBe(
			MessageFlags.IsComponentsV2,
		)
		const rows = edit.components[0].components
		expect(rows[3].components.map((b: any) => b.disabled)).toEqual([
			undefined,
			undefined,
		])
		expect(rows[5].components.map((b: any) => b.disabled)).toEqual([
			true,
			true,
		])
		expect(rows[4].content).toContain('**Result: Over ❌ — 0**')
	})

	it('refuses to start a second edit while the message lock is held', async () => {
		vi.useFakeTimers()
		try {
			const message = createMessage()
			const channel = {
				guildId: 'guild-1',
				isTextBased: () => true,
				messages: { fetch: vi.fn().mockResolvedValue(message) },
			}
			mocks.fetchChannel.mockResolvedValue(channel)
			mocks.redisSet.mockResolvedValue(null)

			const delivery =
				new NotificationService().deliverPropSettlementMessage(
					payload,
					payload.messages[0],
				)
			const outcome = expect(delivery).rejects.toMatchObject({
				code: 'PROP_SETTLEMENT_BUSY',
			})
			await vi.advanceTimersByTimeAsync(21_000)
			await outcome

			expect(message.edit).not.toHaveBeenCalled()
			expect(mocks.redisCompareAndRemove).not.toHaveBeenCalled()
		} finally {
			vi.useRealTimers()
		}
	})

	it('lets the route retry when a settlement loses the message lock', async () => {
		vi.useFakeTimers()
		try {
			const message = createMessage()
			const channel = {
				guildId: 'guild-1',
				isTextBased: () => true,
				messages: { fetch: vi.fn().mockResolvedValue(message) },
			}
			mocks.fetchChannel.mockResolvedValue(channel)
			mocks.redisSet.mockResolvedValue(null)

			const delivery = new NotificationService().processPropSettled(
				payload,
			)
			const outcome = expect(delivery).rejects.toMatchObject({
				code: 'PROP_SETTLEMENT_BUSY',
			})
			await vi.advanceTimersByTimeAsync(21_000)
			await outcome

			expect(message.edit).not.toHaveBeenCalled()
		} finally {
			vi.useRealTimers()
		}
	})

	it('releases the message lock after a successful edit', async () => {
		const message = createMessage()
		const channel = {
			guildId: 'guild-1',
			isTextBased: () => true,
			messages: { fetch: vi.fn().mockResolvedValue(message) },
		}
		mocks.fetchChannel.mockResolvedValue(channel)

		await new NotificationService().deliverPropSettlementMessage(
			payload,
			payload.messages[0],
		)

		expect(mocks.redisSet).toHaveBeenCalledWith(
			'props:settlement-lock:guild-1:channel-1:message-1',
			expect.any(String),
			'EX',
			60,
			'NX',
		)
		expect(mocks.redisCompareAndRemove).toHaveBeenCalledOnce()
	})

	it('fails the delivery for a retry instead of editing when Redis is unavailable', async () => {
		const message = createMessage()
		const channel = {
			guildId: 'guild-1',
			isTextBased: () => true,
			messages: { fetch: vi.fn().mockResolvedValue(message) },
		}
		mocks.fetchChannel.mockResolvedValue(channel)
		mocks.redisSet.mockRejectedValueOnce(new Error('redis down'))

		await expect(
			new NotificationService().deliverPropSettlementMessage(
				payload,
				payload.messages[0],
			),
		).rejects.toMatchObject({ code: 'PROP_SETTLEMENT_BUSY' })

		expect(message.edit).not.toHaveBeenCalled()
		expect(mocks.logger.warn).toHaveBeenCalledWith(
			expect.objectContaining({
				event: 'prop.settlement.lock_unavailable',
			}),
		)
	})

	it('does not edit after losing the message lock', async () => {
		const message = createMessage()
		const channel = {
			guildId: 'guild-1',
			isTextBased: () => true,
			messages: { fetch: vi.fn().mockResolvedValue(message) },
		}
		mocks.fetchChannel.mockResolvedValue(channel)
		mocks.redisRefreshIfOwned.mockResolvedValueOnce(false)

		await expect(
			new NotificationService().deliverPropSettlementMessage(
				payload,
				payload.messages[0],
			),
		).rejects.toMatchObject({ code: 'PROP_SETTLEMENT_BUSY' })

		expect(message.edit).not.toHaveBeenCalled()
	})

	it('waits for the current holder and edits once the lock is free', async () => {
		const message = createMessage()
		const channel = {
			guildId: 'guild-1',
			isTextBased: () => true,
			messages: { fetch: vi.fn().mockResolvedValue(message) },
		}
		mocks.fetchChannel.mockResolvedValue(channel)
		mocks.redisSet.mockResolvedValueOnce(null).mockResolvedValueOnce('OK')

		await new NotificationService().deliverPropSettlementMessage(
			payload,
			payload.messages[0],
		)

		expect(mocks.redisSet).toHaveBeenCalledTimes(2)
		expect(message.edit).toHaveBeenCalledOnce()
	})

	it('fails the delivery when the holder keeps the lock past the wait budget', async () => {
		vi.useFakeTimers()
		try {
			const message = createMessage()
			const channel = {
				guildId: 'guild-1',
				isTextBased: () => true,
				messages: { fetch: vi.fn().mockResolvedValue(message) },
			}
			mocks.fetchChannel.mockResolvedValue(channel)
			mocks.redisSet.mockResolvedValue(null)

			const delivery =
				new NotificationService().deliverPropSettlementMessage(
					payload,
					payload.messages[0],
				)
			const outcome = expect(delivery).rejects.toMatchObject({
				code: 'PROP_SETTLEMENT_BUSY',
			})
			await vi.advanceTimersByTimeAsync(21_000)
			await outcome

			expect(message.edit).not.toHaveBeenCalled()
		} finally {
			vi.useRealTimers()
		}
	})

	it('fails a settlement whose row is missing from the board', async () => {
		const boardProp = {
			commence_time: '2026-10-04T20:25:00Z',
			market_key: 'player_pass_yds',
			description: 'Patrick Mahomes',
			point: 274.5,
			over: { outcome_uuid: 'over-1', outcome_name: 'Over', price: -115 },
			under: {
				outcome_uuid: 'under-1',
				outcome_name: 'Under',
				price: 105,
			},
		}
		const payloadV2 = propBoardPayload({
			props: [boardProp] as never,
			sport: 'nfl',
			teams: {
				homeAbbrev: ['KC'],
				awayAbbrev: ['BUF'],
				homeColor: 0xe31837,
			},
		})
		const message = {
			embeds: [],
			components: payloadV2.components,
			flags: { has: () => true },
			edit: vi.fn(),
		} as any
		const channel = {
			guildId: 'guild-1',
			isTextBased: () => true,
			messages: { fetch: vi.fn().mockResolvedValue(message) },
		}
		mocks.fetchChannel.mockResolvedValue(channel)

		await expect(
			new NotificationService().processPropSettled({
				...payload,
				outcome_uuid: 'not-on-the-board',
			}),
		).rejects.toMatchObject({ code: 'PROP_SETTLEMENT_ROW_MISSING' })

		expect(message.edit).not.toHaveBeenCalled()
	})
})
