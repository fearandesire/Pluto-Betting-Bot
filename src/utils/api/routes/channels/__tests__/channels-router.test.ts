import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
	process: vi.fn(),
	deleteChan: vi.fn(),
}))

vi.mock('../../../../guilds/channels/ChannelManager.js', () => ({
	default: class {
		validateAndParseChannels = vi.fn()
		processChannels = mocks.process
		deleteChan = mocks.deleteChan
	},
}))
vi.mock('../../../../logging/WinstonLogger.js', () => ({
	logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { logger } from '../../../../logging/WinstonLogger.js'
import ChannelsRoutes from '../channels-router.js'

const handler = (method: string, path: string) =>
	(ChannelsRoutes as any).stack.find(
		(layer: any) => layer.path === path && layer.methods.includes(method),
	).stack[0] as (ctx: any) => Promise<void>

beforeEach(() => vi.clearAllMocks())

describe('POST /channels/create logging', () => {
	it('logs counts and game ids, never the request body', async () => {
		const body = {
			channels: [
				{
					id: '0F0E0D0C-0B0A-4908-8706-050403020100',
					channelname: 'celtics-at-pistons',
					home_team: 'Detroit Pistons',
				},
			],
			guilds: [{ guildId: 'guild-1', bettingChannelId: 'secret-chan' }],
		}
		const ctx: any = { request: { body } }
		await handler('POST', '/channels/create')(ctx)
		expect(logger.info).toHaveBeenCalledWith(
			'Received request to create channels',
			{
				channelCount: 1,
				guildCount: 1,
				gameIds: ['0f0e0d0c0b0a49088706050403020100'],
			},
		)
		const logged = JSON.stringify(vi.mocked(logger.info).mock.calls)
		expect(logged).not.toContain('secret-chan')
		expect(logged).not.toContain('Detroit Pistons')
	})
	it('survives a malformed body', async () => {
		await handler(
			'POST',
			'/channels/create',
		)({
			request: { body: undefined },
		}).catch(() => undefined)
		expect(logger.info).toHaveBeenCalledWith(
			'Received request to create channels',
			{ channelCount: 0, guildCount: 0, gameIds: [] },
		)
	})
})

describe('DELETE /channels/delete logging', () => {
	it('logs through the structured logger', async () => {
		const ctx: any = { request: { body: { channelNames: ['a', 'b'] } } }
		await handler('DELETE', '/channels/delete')(ctx)
		expect(mocks.deleteChan).toHaveBeenCalledTimes(2)
		expect(logger.info).toHaveBeenCalledWith(
			'Completed channel deletion.',
			{
				route: '/channels/delete',
				channelCount: 2,
			},
		)
	})
})
