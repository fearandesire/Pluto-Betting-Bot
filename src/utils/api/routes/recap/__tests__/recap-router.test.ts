import { beforeEach, describe, expect, it, vi } from 'vitest'

const post = vi.fn()

vi.mock('../../../../logging/WinstonLogger.js', () => ({
	logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))

vi.mock('../../../../recap/recap-post-service.js', () => ({
	explicitChannelResolver: {},
	RecapPostService: class {
		post = post
	},
}))

vi.mock('../../../Khronos/recap/recap-wrapper.js', () => ({
	default: class {},
}))

import RecapRouter, { postRecapSchema } from '../recap-router.js'

const valid = {
	guild_id: '555171631539028000',
	channel_id: '123456789012345678',
	type: 'monthly',
}

async function run(body: unknown, authenticated: boolean | undefined) {
	const layer = RecapRouter.stack.find(
		(candidate) => candidate.path === '/recap/post',
	)
	if (!layer) throw new Error('recap route not registered')
	const ctx = {
		request: { body },
		state: { apiKeyAuthenticated: authenticated },
		status: 404,
		body: undefined as unknown,
	}
	const handler = layer.stack[layer.stack.length - 1]
	await handler(ctx as never, async () => undefined)
	return ctx
}

describe('POST /recap/post', () => {
	beforeEach(() => {
		post.mockReset()
		post.mockResolvedValue({ channel_id: 'c', message_id: 'm' })
	})

	it('rejects a request the API key middleware did not authenticate', async () => {
		const ctx = await run(valid, undefined)

		expect(ctx.status).toBe(401)
		expect(post).not.toHaveBeenCalled()
	})

	it.each([
		['non-numeric guild', { ...valid, guild_id: 'abc' }],
		['short channel', { ...valid, channel_id: '12345' }],
		['21-digit channel', { ...valid, channel_id: '1'.repeat(21) }],
		['empty body', {}],
	])('answers 422 for %s without posting', async (_name, body) => {
		const ctx = await run(body, true)

		expect(ctx.status).toBe(422)
		expect(post).not.toHaveBeenCalled()
	})

	it('posts for an authenticated, well-formed request', async () => {
		const ctx = await run(valid, true)

		expect(ctx.status).toBe(200)
		expect(post).toHaveBeenCalledWith({
			guildId: valid.guild_id,
			channelId: valid.channel_id,
			type: 'monthly',
			sport: 'nfl',
		})
	})
})

describe('postRecapSchema', () => {
	it('accepts 17- and 20-digit snowflakes only', () => {
		const accepts = (guild: string, channel: string) =>
			postRecapSchema.safeParse({
				...valid,
				guild_id: guild,
				channel_id: channel,
			}).success
		expect(accepts('1'.repeat(17), '1'.repeat(20))).toBe(true)
		expect(accepts('1'.repeat(16), '1'.repeat(20))).toBe(false)
		expect(accepts('1'.repeat(17), '1'.repeat(21))).toBe(false)
	})
})
