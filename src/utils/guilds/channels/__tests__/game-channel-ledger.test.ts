import { SnowflakeUtil } from 'discord.js'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../../../../lib/startup/env.js', () => ({
	default: { USE_MOCK_DATA: true },
}))
vi.mock('../../../logging/WinstonLogger.js', () => ({
	logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { InMemoryRedis } from '../../../cache/redis-instance.js'
import {
	adoptableGameChannels,
	RedisGameChannelLedger,
} from '../game-channel-ledger.js'

const at = (ms: number) => SnowflakeUtil.generate({ timestamp: ms }).toString()
const intent = { channelName: 'away-at-home', gameCategoryId: 'category' }
const channel = (id: string, overrides = {}) => ({
	id,
	name: 'away-at-home',
	parentId: 'category',
	...overrides,
})

describe('game channel recovery', () => {
	it('adopts nothing for a game that never tried to create a channel', () => {
		expect(
			adoptableGameChannels([channel(at(2_000_000))], intent, null),
		).toEqual([])
	})

	it("does not adopt an earlier game's same-name channel", () => {
		const previousGame = channel(at(1_000_000))
		const thisGame = channel(at(2_000_000))
		expect(
			adoptableGameChannels([previousGame, thisGame], intent, {
				firstAttemptAt: 2_000_000,
			}),
		).toEqual([thisGame])
	})

	it('ignores same-name channels outside the game category', () => {
		expect(
			adoptableGameChannels(
				[channel(at(2_000_000), { parentId: 'elsewhere' })],
				intent,
				{ firstAttemptAt: 2_000_000 },
			),
		).toEqual([])
	})
})

describe('RedisGameChannelLedger', () => {
	it('keeps the first attempt time across retries', async () => {
		let now = 1_000
		const ledger = new RedisGameChannelLedger(
			new InMemoryRedis(),
			() => now,
		)
		await ledger.beginCreation('guild', 'game')
		now = 9_000
		await expect(ledger.beginCreation('guild', 'game')).resolves.toEqual({
			firstAttemptAt: 1_000,
		})
		await ledger.recordChannel('guild', 'game', 'channel', 'unsent')
		await expect(ledger.get('guild', 'game')).resolves.toEqual({
			firstAttemptAt: 1_000,
			channelId: 'channel',
			delivery: 'unsent',
		})
	})

	it('records a send only once, for the channel it created', async () => {
		const ledger = new RedisGameChannelLedger(new InMemoryRedis())
		await ledger.beginCreation('guild', 'game')
		await ledger.recordChannel('guild', 'game', 'channel', 'unsent')
		await expect(ledger.markSent('guild', 'game', 'other')).rejects.toThrow(
			'requires reconciliation',
		)
		await ledger.markSent('guild', 'game', 'channel')
		await expect(
			ledger.markSent('guild', 'game', 'channel'),
		).rejects.toThrow('requires reconciliation')
		await expect(ledger.get('guild', 'game')).resolves.toMatchObject({
			delivery: 'sent',
		})
	})
})
