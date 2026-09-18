import { createServer, type Server } from 'node:http'
import Koa from 'koa'
import bodyParser from 'koa-bodyparser'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const logger = vi.hoisted(() => ({
	error: vi.fn(),
	warn: vi.fn(),
	info: vi.fn(),
}))
const acceptDetailed = vi.hoisted(() => vi.fn())

vi.mock('../../../../logging/WinstonLogger.js', () => ({ logger }))
vi.mock('../../notifications/delivery-queue.js', () => ({
	getNotificationDeliveryQueue: () => ({ acceptDetailed }),
}))

import PropsRouter from '../props-router.js'

const validPayload = {
	props: [
		{
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
		},
	],
	guilds: [{ guild_id: 'guild-1', channel_id: 'channel-1', sport: 'nba' }],
}

const validEnvelope = {
	delivery_id: '550e8400-e29b-41d4-a716-446655440010',
	schema_version: 1,
	kind: 'prop_post',
	occurred_at: '2026-07-14T20:00:00.000Z',
	payload: validPayload,
}

const queuedRecord = {
	delivery_id: validEnvelope.delivery_id,
	kind: 'prop_post',
	schema_version: 1,
	occurred_at: validEnvelope.occurred_at,
	payload: validPayload,
	payload_hash: 'hash',
	state: 'queued',
	attempts: 0,
	destinations: [],
	created_at: validEnvelope.occurred_at,
	updated_at: validEnvelope.occurred_at,
} as const

describe('POST /props/daily', () => {
	let server: Server | undefined

	beforeEach(() => {
		vi.clearAllMocks()
		acceptDetailed.mockResolvedValue({
			record: queuedRecord,
			duplicate: false,
		})
	})

	afterEach(async () => {
		if (server?.listening) {
			await new Promise<void>((resolve, reject) => {
				server.close((error) => (error ? reject(error) : resolve()))
			})
		}
	})

	async function request(payload: unknown) {
		const app = new Koa()
		app.use(bodyParser())
		app.use(PropsRouter.routes())
		server = createServer(app.callback())

		await new Promise<void>((resolve) => {
			server.listen(0, '127.0.0.1', () => resolve())
		})
		const address = server.address()
		if (!address || typeof address === 'string') {
			throw new Error('Test server did not expose a TCP address')
		}

		return fetch(`http://127.0.0.1:${address.port}/props/daily`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(payload),
		})
	}

	it('durably accepts a validated prop-post envelope before Discord delivery', async () => {
		const response = await request(validEnvelope)

		expect(response.status).toBe(202)
		expect(await response.json()).toMatchObject({
			accepted: true,
			duplicate: false,
			delivery_id: validEnvelope.delivery_id,
			kind: 'prop_post',
			status: 'queued',
		})
		expect(acceptDetailed).toHaveBeenCalledWith(validEnvelope)
	})

	it('rejects malformed payloads with structured 422 errors', async () => {
		const response = await request({ props: [] })

		expect(response.status).toBe(422)
		const body = await response.json()
		expect(body).toMatchObject({
			success: false,
			error: 'Invalid prop-post delivery envelope. Failed Zod validation.',
		})
		expect(body.issues).toEqual(expect.any(Array))
		expect(acceptDetailed).not.toHaveBeenCalled()
	})

	it('rejects unsupported guild sports with 422', async () => {
		const response = await request({
			...validEnvelope,
			payload: {
				...validPayload,
				guilds: [
					{
						guild_id: 'guild-1',
						channel_id: 'channel-1',
						sport: 'mlb',
					},
				],
			},
		})

		expect(response.status).toBe(422)
		expect(acceptDetailed).not.toHaveBeenCalled()
		expect(logger.warn).toHaveBeenCalledWith(
			expect.objectContaining({
				event: 'push_payload_rejected',
				schema: 'dailyPropsPayload',
			}),
		)
	})

	it('returns 503 when durable queue acceptance fails', async () => {
		acceptDetailed.mockRejectedValueOnce(new Error('Redis unavailable'))

		const response = await request(validEnvelope)

		expect(response.status).toBe(503)
		expect(await response.json()).toEqual({
			success: false,
			error: 'Prop-post delivery queue unavailable.',
		})
		expect(logger.error).toHaveBeenCalledWith(
			expect.objectContaining({ event: 'props_daily_queue_failed' }),
		)
	})

	it('returns 409 when delivery ID is reused with a different payload', async () => {
		const error = Object.assign(new Error('mismatch'), {
			code: 'DELIVERY_PAYLOAD_MISMATCH',
		})
		acceptDetailed.mockRejectedValueOnce(error)

		const response = await request(validEnvelope)

		expect(response.status).toBe(409)
		expect(await response.json()).toMatchObject({
			code: 'DELIVERY_PAYLOAD_MISMATCH',
		})
	})
})
