import { EmbedBuilder } from 'discord.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
	fetchChannel: vi.fn(),
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

function createMessage() {
	const message = {
		embeds: [
			new EmbedBuilder().setTitle('🎯 Accuracy Challenge').addFields({
				name: 'Match',
				value: 'GSW vs LAL',
				inline: true,
			}),
		],
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

describe('NotificationService.processPropSettled', () => {
	beforeEach(() => {
		vi.clearAllMocks()
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

		expect(channel.messages.fetch).toHaveBeenCalledWith('message-1')
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
		mocks.fetchChannel.mockRejectedValue(new Error('Unknown Message'))

		await expect(
			new NotificationService().processPropSettled(payload),
		).resolves.toBeUndefined()

		expect(mocks.logger.warn).toHaveBeenCalledWith(
			expect.objectContaining({
				event: 'prop.notification.message_update_failed',
				message_id: 'message-1',
			}),
		)
	})
})
