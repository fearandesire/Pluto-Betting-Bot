import { beforeEach, describe, expect, it, vi } from 'vitest'

const processParlayResult = vi.fn()

vi.mock('../../../../logging/WinstonLogger.js', () => ({
	logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))

vi.mock('../notifications.service.js', () => ({
	default: class MockNotificationService {
		processParlayResult = processParlayResult
	},
}))

import NotificationRouter from '../notifications.controller.js'

const validPayload = {
	kind: 'won',
	parlay_id: '11111111-1111-4111-8111-111111111110',
	user_id: 'user-1',
	stake: 10,
	combined_odds_american: 377,
	payout: 47.7,
	actual_payout: 47.7,
	legs: [
		{
			id: 'leg-1',
			event_id: 'event-1',
			outcome_uuid: 'outcome-1',
			market_key: 'h2h',
			selection_display: 'Lakers',
			odds_american: -110,
			point: null,
			commence_time: '2026-07-11T20:00:00.000Z',
			result: 'won',
		},
		{
			id: 'leg-2',
			event_id: 'event-2',
			outcome_uuid: 'outcome-2',
			market_key: 'totals',
			selection_display: 'Over 220.5',
			odds_american: 105,
			point: 220.5,
			commence_time: '2026-07-11T20:00:00.000Z',
			result: 'won',
		},
	],
}

function getParlayRoute() {
	const route = NotificationRouter.stack.find(
		(layer) => layer.path === '/notifications/parlays/results',
	)
	if (!route) throw new Error('Parlay notification route not registered')
	return route.stack[0]
}

describe('POST /notifications/parlays/results', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it('returns 200 after processing a valid payload', async () => {
		const ctx = {
			request: { body: validPayload },
			body: undefined as unknown,
			status: 200,
		}

		await getParlayRoute()(ctx as never, async () => undefined)

		expect(processParlayResult).toHaveBeenCalledOnce()
		expect(ctx.status).toBe(200)
		expect(ctx.body).toEqual({ success: true })
	})

	it('returns 422 and skips delivery for malformed payloads', async () => {
		const ctx = {
			request: { body: { ...validPayload, parlay_id: 'not-a-uuid' } },
			body: undefined as unknown,
			status: 200,
		}

		await getParlayRoute()(ctx as never, async () => undefined)

		expect(processParlayResult).not.toHaveBeenCalled()
		expect(ctx.status).toBe(422)
		expect(ctx.body).toEqual({
			success: false,
			error: 'Invalid parlay notification data. Failed Zod validation.',
		})
	})
})
