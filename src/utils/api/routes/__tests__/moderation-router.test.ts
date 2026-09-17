import { createServer, type Server } from 'node:http'
import Koa from 'koa'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const lookup = vi.hoisted(() => vi.fn())
const logger = vi.hoisted(() => ({ warn: vi.fn() }))

vi.mock('#lib/startup/env.js', () => ({
	default: { API_KEY: 'test-api-key' },
}))
vi.mock('../../../logging/WinstonLogger.js', () => ({ logger }))
vi.mock('../moderation/moderation-service.js', () => ({
	GuildModeratorLookupService: class {
		lookup = lookup
	},
}))

import { createApiKeyAuthMiddleware } from '../../koa/setup/apiKeyAuth.js'
import ModerationRouter from '../moderation/moderation-router.js'

const USER_ID = '123456789012345678'

describe('GET /internal/moderation/guilds', () => {
	let server: Server | undefined

	beforeEach(() => {
		vi.clearAllMocks()
		lookup.mockResolvedValue({
			user_id: USER_ID,
			guilds: [],
			checked_at: '2026-09-17T12:00:00.000Z',
		})
	})

	afterEach(async () => {
		if (server?.listening) {
			await new Promise<void>((resolve, reject) => {
				server?.close((error) => (error ? reject(error) : resolve()))
			})
		}
	})

	async function request(options: {
		userId?: string
		authenticated?: boolean
	}) {
		const app = new Koa()
		app.use(createApiKeyAuthMiddleware())
		app.use(ModerationRouter.routes())
		server = createServer(app.callback())

		await new Promise<void>((resolve) => {
			server?.listen(0, '127.0.0.1', () => resolve())
		})
		const address = server.address()
		if (!address || typeof address === 'string') {
			throw new Error('Test server did not expose a TCP address')
		}

		const query = options.userId
			? `?user_id=${encodeURIComponent(options.userId)}`
			: ''
		return fetch(
			`http://127.0.0.1:${address.port}/internal/moderation/guilds${query}`,
			{
				headers: options.authenticated
					? { 'X-API-Key': 'test-api-key' }
					: undefined,
			},
		)
	}

	it('returns the lookup response for an authenticated caller', async () => {
		const response = await request({ userId: USER_ID, authenticated: true })

		expect(response.status).toBe(200)
		expect(await response.json()).toEqual({
			user_id: USER_ID,
			guilds: [],
			checked_at: '2026-09-17T12:00:00.000Z',
		})
		expect(lookup).toHaveBeenCalledWith(USER_ID)
	})

	it('returns 400 when user_id is missing', async () => {
		const response = await request({ authenticated: true })

		expect(response.status).toBe(400)
		expect(lookup).not.toHaveBeenCalled()
	})

	it('returns 400 when user_id is not a Discord snowflake', async () => {
		const response = await request({
			userId: 'not-a-snowflake',
			authenticated: true,
		})

		expect(response.status).toBe(400)
		expect(lookup).not.toHaveBeenCalled()
	})

	it('returns 503 without partial data when Discord lookup fails', async () => {
		lookup.mockRejectedValueOnce(
			Object.assign(new Error('Discord unavailable'), {
				code: 'MODERATION_LOOKUP_UNAVAILABLE',
			}),
		)

		const response = await request({ userId: USER_ID, authenticated: true })

		expect(response.status).toBe(503)
		expect(await response.json()).toEqual({
			error: 'moderation_lookup_unavailable',
		})
	})

	it('returns the existing 401 response when unauthenticated', async () => {
		const response = await request({ userId: USER_ID })

		expect(response.status).toBe(401)
		expect(lookup).not.toHaveBeenCalled()
	})
})
