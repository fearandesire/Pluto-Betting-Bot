import { beforeEach, describe, expect, it, vi } from 'vitest'

const processPropSettled = vi.fn()

vi.mock('../../../../logging/WinstonLogger.js', () => ({
	logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))

vi.mock('../notifications.service.js', () => ({
	default: class MockNotificationService {
		processPropSettled = processPropSettled
	},
}))

import NotificationRouter from '../notifications.controller.js'

const validPayload = {
	outcome_uuid: '550e8400-e29b-41d4-a716-446655440000',
	result: 'won',
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

function getPropSettlementRoute() {
	const route = NotificationRouter.stack.find(
		(layer) => layer.path === '/notifications/props/settled',
	)
	if (!route)
		throw new Error('Prop settlement notification route not registered')
	return route.stack[0]
}

describe('POST /notifications/props/settled', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it('returns 200 after processing a valid payload', async () => {
		const ctx = {
			request: { body: validPayload },
			body: undefined as unknown,
			status: 200,
		}

		await getPropSettlementRoute()(ctx as never, async () => undefined)

		expect(processPropSettled).toHaveBeenCalledOnce()
		expect(ctx.status).toBe(200)
		expect(ctx.body).toEqual({ success: true })
	})

	it('returns 422 and skips delivery for malformed payloads', async () => {
		const ctx = {
			request: { body: { ...validPayload, outcome_uuid: 'not-a-uuid' } },
			body: undefined as unknown,
			status: 200,
		}

		await getPropSettlementRoute()(ctx as never, async () => undefined)

		expect(processPropSettled).not.toHaveBeenCalled()
		expect(ctx.status).toBe(422)
		expect(ctx.body).toEqual({
			success: false,
			error: 'Invalid prop settlement notification data. Failed Zod validation.',
		})
	})
})
