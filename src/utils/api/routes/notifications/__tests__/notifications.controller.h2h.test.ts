import { beforeEach, describe, expect, it, vi } from 'vitest'

const accept = vi.fn()

vi.mock('../../../../logging/WinstonLogger.js', () => ({
	logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))

vi.mock('../delivery-queue.js', () => ({
	getNotificationDeliveryQueue: () => ({ accept }),
}))

import NotificationRouter from '../notifications.controller.js'

const validEnvelope = {
	delivery_id: '550e8400-e29b-41d4-a716-446655440020',
	schema_version: 1 as const,
	kind: 'h2h_result' as const,
	occurred_at: '2026-07-14T20:00:00.000Z',
	payload: {
		user_id: 'synthetic-user',
		bet_id: 7,
		event_id: 'synthetic-event',
		outcome_uuid: '550e8400-e29b-41d4-a716-446655440021',
		result: 'won' as const,
		team: 'Home',
		stake: 10,
		payout: 25,
		profit: 15,
	},
}

function getRoute() {
	const route = NotificationRouter.stack.find(
		(layer) => layer.path === '/notifications/bets/results',
	)
	if (!route) throw new Error('H2H notification route not registered')
	return route.stack[0]
}

describe('POST /notifications/bets/results H2H durable envelope', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		accept.mockResolvedValue({
			delivery_id: validEnvelope.delivery_id,
			state: 'queued',
		})
	})

	it('returns 202 after durable acceptance', async () => {
		const ctx = {
			request: { body: validEnvelope },
			body: undefined,
			status: 200,
		}

		await getRoute()(ctx as never, async () => undefined)

		expect(accept).toHaveBeenCalledWith(validEnvelope)
		expect(ctx.status).toBe(202)
		expect(ctx.body).toEqual({
			delivery_id: validEnvelope.delivery_id,
			status: 'queued',
		})
	})

	it('returns 409 for a delivery ID payload conflict', async () => {
		const conflict = Object.assign(new Error('conflict'), {
			code: 'DELIVERY_PAYLOAD_MISMATCH',
		})
		accept.mockRejectedValue(conflict)
		const ctx = {
			request: { body: validEnvelope },
			body: undefined,
			status: 200,
		}

		await getRoute()(ctx as never, async () => undefined)

		expect(ctx.status).toBe(409)
		expect(ctx.body).toMatchObject({ code: 'DELIVERY_PAYLOAD_MISMATCH' })
	})

	it('rejects malformed delivery envelopes before legacy parsing', async () => {
		const ctx = {
			request: {
				body: { delivery_id: validEnvelope.delivery_id, winners: [] },
			},
			body: undefined,
			status: 200,
		}

		await getRoute()(ctx as never, async () => undefined)

		expect(accept).not.toHaveBeenCalled()
		expect(ctx.status).toBe(422)
		expect(ctx.body).toMatchObject({
			error: 'Invalid delivery envelope. Failed Zod validation.',
		})
	})
})
