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

const refs = [
	{
		outcome_uuid: validPayload.props[0].over.outcome_uuid,
		guild_id: 'guild-1',
		channel_id: 'channel-1',
		message_id: 'message-1',
	},
	{
		outcome_uuid: validPayload.props[0].under.outcome_uuid,
		guild_id: 'guild-1',
		channel_id: 'channel-1',
		message_id: 'message-1',
	},
]

describe('POST /props/daily', () => {
	let server: Server | undefined

	beforeEach(() => {
		vi.clearAllMocks()
		postPropsToChannel.mockResolvedValue({
			posted: 1,
			filtered: 0,
			failed: 0,
			total: 1,
			results: refs,
			failures: [],
		})
	})

	afterEach(async () => {
		if (server?.listening) {
			await new Promise<void>((resolve, reject) => {
				server?.close((error) => (error ? reject(error) : resolve()))
			})
		}
	})

	async function request(payload: unknown) {
		const app = new Koa()
		app.use(bodyParser())
		app.use(PropsRouter.routes())
		server = createServer(app.callback())

		await new Promise<void>((resolve) => {
			server?.listen(0, '127.0.0.1', () => resolve())
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

	it('returns one ledger reference for every posted outcome', async () => {
		const response = await request(validPayload)

		expect(response.status).toBe(200)
		expect(await response.json()).toEqual(refs)
		expect(postPropsToChannel).toHaveBeenCalledWith(
			'guild-1',
			validPayload.props,
			'nba',
			'channel-1',
		)
	})

	it('rejects malformed payloads with structured 422 errors', async () => {
		const response = await request({ props: [] })

		expect(response.status).toBe(422)
		const body = await response.json()
		expect(body).toMatchObject({
			success: false,
			error: 'Invalid props payload. Failed Zod validation.',
		})
		expect(body.issues).toEqual(expect.any(Array))
		expect(postPropsToChannel).not.toHaveBeenCalled()
	})

	it('returns successful refs with 207 when a guild has partial failures', async () => {
		postPropsToChannel.mockResolvedValue({
			posted: 1,
			filtered: 0,
			failed: 1,
			total: 2,
			results: refs,
			failures: [
				{
					guild_id: 'guild-1',
					channel_id: 'channel-1',
					outcome_uuids: ['550e8400-e29b-41d4-a716-446655440002'],
					error: 'Discord unavailable',
				},
			],
		})

		const response = await request(validPayload)

		expect(response.status).toBe(207)
		expect(response.headers.get('x-props-failed')).toBe('1')
		expect(await response.json()).toEqual(refs)
	})
})
