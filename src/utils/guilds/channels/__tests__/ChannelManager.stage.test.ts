import { ChannelType } from 'discord.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ guilds: new Map<string, any>() }))

vi.mock('../../../../index.js', () => ({
	SapDiscClient: { guilds: { cache: mocks.guilds } },
}))
vi.mock('resolve-team', () => ({ teamResolver: { resolve: vi.fn() } }))
vi.mock('../../../cache/redis-instance.js', () => ({ default: {} }))
vi.mock('../../../../lib/startup/env.js', () => ({
	default: { KH_API_URL: 'http://fixture.invalid' },
}))
vi.mock('../../../logging/WinstonLogger.js', () => ({
	logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))
vi.mock('../../../bot_res/findEmoji.js', () => ({
	findEmoji: vi.fn(async () => ''),
}))
vi.mock('../channel-presentation-lock.js', () => ({
	RedisPresentationLock: class {
		run(_key: string, action: (check: () => Promise<void>) => unknown) {
			return action(async () => undefined)
		}
	},
}))

import { logger } from '../../../logging/WinstonLogger.js'
import ChannelManager from '../ChannelManager.js'

const gameId = '0f0e0d0c-0b0a-4908-8706-050403020100'
const hexId = gameId.replaceAll('-', '')
const channel = (sport = 'nba') =>
	({ id: gameId, sport, channelname: 'celtics-at-pistons' }) as any
const guild = (over: Record<string, unknown> = {}) =>
	({
		guildId: 'guild-1',
		sport: 'nba',
		eligibleMatches: [gameId],
		...over,
	}) as any

const stageLines = () =>
	(['info', 'warn', 'error'] as const)
		.flatMap((level) => vi.mocked(logger[level]).mock.calls)
		.map(([line]) => line as Record<string, unknown>)
		.filter((line) => line.event === 'game_channel.stage')
		.map(
			({
				stage,
				outcome,
				reason,
				game_id,
				guild_id,
				sport,
				channel_name,
			}) =>
				JSON.parse(
					JSON.stringify({
						stage,
						outcome,
						reason,
						game_id,
						guild_id,
						sport,
						channel_name,
					}),
				),
		)

beforeEach(() => {
	vi.clearAllMocks()
	mocks.guilds.clear()
})

describe('ChannelManager eligibility game_channel.stage', () => {
	it('reports a game the guild is not eligible for', async () => {
		await new ChannelManager({} as any, {} as any).processChannels({
			channels: [channel()],
			guilds: [guild({ eligibleMatches: [] })],
		} as any)
		expect(stageLines()).toEqual([
			{
				stage: 'created',
				outcome: 'skipped',
				reason: 'not_eligible',
				game_id: hexId,
				guild_id: 'guild-1',
				sport: 'nba',
			},
		])
	})
	it('reports a guild that serves another sport', async () => {
		await new ChannelManager({} as any, {} as any).processChannels({
			channels: [channel('nfl')],
			guilds: [guild({ sport: 'nba' })],
		} as any)
		expect(stageLines()).toEqual([
			{
				stage: 'created',
				outcome: 'skipped',
				reason: 'wrong_sport',
				game_id: hexId,
				guild_id: 'guild-1',
				sport: 'nfl',
			},
		])
	})
})

describe('ChannelManager.deleteChan game_channel.stage', () => {
	const textChannel = (remove: () => Promise<void>) => ({
		id: 'discord-1',
		name: 'celtics-at-pistons',
		guildId: 'guild-1',
		type: ChannelType.GuildText,
		delete: remove,
	})
	const withChannel = (remove: () => Promise<void>) =>
		mocks.guilds.set('guild-1', {
			channels: {
				cache: { find: () => textChannel(remove) },
			},
		})
	const ledger = (owner: string | null) => ({ ownerOf: async () => owner })

	it('reports a delete as ok with the game it belonged to', async () => {
		withChannel(async () => undefined)
		await new ChannelManager(
			{} as any,
			ledger(`guild-1:${gameId}`) as any,
		).deleteChan('celtics-at-pistons')
		expect(stageLines()).toEqual([
			{
				stage: 'deleted',
				outcome: 'ok',
				reason: 'deleted',
				game_id: hexId,
				guild_id: 'guild-1',
				channel_name: 'celtics-at-pistons',
			},
		])
	})
	it('reports a Discord failure and rethrows', async () => {
		withChannel(async () => {
			throw new Error('Missing Permissions')
		})
		await expect(
			new ChannelManager({} as any, ledger(null) as any).deleteChan(
				'celtics-at-pistons',
			),
		).rejects.toThrow('Missing Permissions')
		expect(stageLines()).toEqual([
			{
				stage: 'deleted',
				outcome: 'failed',
				reason: 'discord_delete_failed',
				guild_id: 'guild-1',
				channel_name: 'celtics-at-pistons',
			},
		])
	})
	it('reports a name that matches no channel as skipped', async () => {
		await new ChannelManager({} as any, ledger(null) as any).deleteChan(
			'celtics-at-pistons',
		)
		expect(stageLines()).toEqual([
			{
				stage: 'deleted',
				outcome: 'skipped',
				reason: 'channel_not_found',
				channel_name: 'celtics-at-pistons',
			},
		])
	})
})
