import { createServer, type Server } from 'node:http'
import Koa from 'koa'
import bodyParser from 'koa-bodyparser'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const logger = vi.hoisted(() => ({
	error: vi.fn(),
	warn: vi.fn(),
	info: vi.fn(),
}))
const postPropsToChannel = vi.hoisted(() => vi.fn())

vi.mock('../../../../logging/WinstonLogger.js', () => ({ logger }))
vi.mock('../../../../props/PropPostingHandler.js', () => {
	function MockPropPostingHandler(this: {
		postPropsToChannel: typeof postPropsToChannel
	}) {
		this.postPropsToChannel = postPropsToChannel
	}

	return { PropPostingHandler: MockPropPostingHandler }
})

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

describe('POST /props/daily', () => {
	let server: Server | undefined

	beforeEach(() => {
		vi.clearAllMocks()
		postPropsToChannel.mockResolvedValue({
			posted: 1,
			filtered: 0,
			failed: 0,
			total: 1,
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

	it('passes validated compact props to the posting handler', async () => {
		const response = await request(validPayload)

		expect(response.status).toBe(200)
		expect(await response.json()).toEqual({
			success: true,
			results: [{ posted: 1, filtered: 0, failed: 0, total: 1 }],
		})
		expect(postPropsToChannel).toHaveBeenCalledWith(
			'guild-1',
			validPayload.props,
			'nba',
			'channel-1',
		)
	})

	it('rejects unsupported guild sports with 422', async () => {
		const response = await request({
			...validPayload,
			guilds: [
				{ guild_id: 'guild-1', channel_id: 'channel-1', sport: 'mlb' },
			],
		})

		expect(response.status).toBe(422)
		expect(postPropsToChannel).not.toHaveBeenCalled()
		expect(logger.warn).toHaveBeenCalledWith(
			expect.objectContaining({
				event: 'push_payload_rejected',
				schema: 'dailyPropsPayload',
			}),
		)
	})

	it('returns a retryable failure when a guild cannot receive props', async () => {
		postPropsToChannel.mockResolvedValue({
			posted: 0,
			filtered: 0,
			failed: 1,
			total: 1,
		})

		const response = await request(validPayload)

		expect(response.status).toBe(500)
		expect(await response.json()).toEqual({
			success: false,
			error: 'Failed to deliver one or more daily props.',
			results: [{ posted: 0, filtered: 0, failed: 1, total: 1 }],
		})
		expect(logger.error).toHaveBeenCalledWith(
			expect.objectContaining({
				event: 'props_daily_delivery_failed',
				failed: 1,
			}),
		)
	})
})
