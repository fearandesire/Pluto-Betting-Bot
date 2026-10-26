import { createHash } from 'node:crypto'
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
	ChannelCreationBusyError,
	LeaseLostError,
} from '../ChannelCreationWorkflow.js'
import { RedisPresentationLock } from '../channel-presentation-lock.js'
import {
	createRecordedGameChannel,
	locateGameChannel,
	RedisGameChannelLedger,
} from '../game-channel-ledger.js'

const at = (ms: number) => SnowflakeUtil.generate({ timestamp: ms }).toString()
const key = {
	guildId: 'guild',
	gameId: 'game-a',
	channelName: 'away-at-home',
	gameCategoryId: 'category',
}
const channel = (id: string, overrides = {}) => ({
	id,
	name: 'away-at-home',
	parentId: 'category',
	topic: 'Enjoy the game!',
	...overrides,
})
const legacyMarker = (gameId: string) =>
	`pluto-game:${createHash('sha256').update(`guild:${gameId}`).digest('hex').slice(0, 24)}`

function ledgerAt(start: number) {
	let now = start
	const redis = new InMemoryRedis()
	const ledger = new RedisGameChannelLedger(
		redis,
		() => now,
		new RedisPresentationLock(redis),
	)
	return { ledger, redis, advance: (ms: number) => (now += ms) }
}

describe('locateGameChannel', () => {
	it('adopts nothing for a game that never tried to create a channel', async () => {
		const { ledger } = ledgerAt(2_000_000)
		await expect(
			locateGameChannel(ledger, key, [channel(at(2_000_000))]),
		).resolves.toBeNull()
	})

	it('finds a recorded channel after members rename or move it', async () => {
		const { ledger } = ledgerAt(2_000_000)
		await ledger.recordChannel('guild', 'game-a', 'renamed')
		const renamed = channel('renamed', { name: 'chat', parentId: 'other' })
		await expect(
			locateGameChannel(ledger, key, [renamed]),
		).resolves.toEqual({ channel: renamed, via: 'recorded' })
	})

	it("recovers only a channel created during this game's settled attempts", async () => {
		const { ledger, advance } = ledgerAt(2_000_000)
		await ledger.beginCreation('guild', 'game-a')
		advance(600_000)
		await ledger.beginCreation('guild', 'game-a')
		advance(2_000)
		await ledger.settleAttempt('guild', 'game-a')
		const earlierGame = channel(at(1_000_000))
		const retryChannel = channel(at(2_601_000))
		const laterGame = channel(at(5_000_000))
		await expect(
			locateGameChannel(
				ledger,
				key,
				[earlierGame, retryChannel, laterGame],
				'unsent',
			),
		).resolves.toEqual({ channel: retryChannel, via: 'recovered' })
		await expect(ledger.get('guild', 'game-a')).resolves.toMatchObject({
			firstAttemptAt: 2_000_000,
			channelId: retryChannel.id,
			delivery: 'unsent',
		})
	})

	it('recovers a rate-limited create that landed after the process stopped', async () => {
		const { ledger } = ledgerAt(2_000_000)
		await ledger.beginCreation('guild', 'game-a')
		// discord.js waited out a 65s Retry-After; the call never settled here.
		const late = channel(at(2_065_000))
		await expect(locateGameChannel(ledger, key, [late])).resolves.toEqual({
			channel: late,
			via: 'recovered',
		})
	})

	it("never adopts another same-name game's channel mid-creation", async () => {
		const { ledger, advance } = ledgerAt(2_000_000)
		// Game A stopped mid-create long ago and never settled.
		await ledger.beginCreation('guild', 'game-a')
		advance(3_600_000)
		const gameB = channel(at(5_600_000))
		let recoveryDuringB: Promise<unknown> | undefined
		await createRecordedGameChannel(
			ledger,
			{ ...key, gameId: 'game-b' },
			async () => {
				// Discord created B's channel; its id is not recorded yet.
				recoveryDuringB = locateGameChannel(ledger, key, [gameB])
				await recoveryDuringB.catch(() => undefined)
				return gameB
			},
		)
		await expect(recoveryDuringB).rejects.toBeInstanceOf(
			ChannelCreationBusyError,
		)
		await expect(
			locateGameChannel(ledger, key, [gameB]),
		).resolves.toBeNull()
		await expect(ledger.get('guild', 'game-a')).resolves.not.toHaveProperty(
			'channelId',
		)
	})

	it('stops a creator that lost its name lease before it records', async () => {
		const { ledger, redis, advance } = ledgerAt(2_000_000)
		await ledger.beginCreation('guild', 'game-a')
		advance(3_600_000)
		const gameB = channel(at(5_600_000))
		const creating = createRecordedGameChannel(
			ledger,
			{ ...key, gameId: 'game-b' },
			async () => {
				// B's lease expires mid-create; A recovers the visible channel.
				await redis.del(
					'pluto:channel-presentation:v1:game-channel-name:guild:away-at-home',
				)
				await expect(
					locateGameChannel(ledger, key, [gameB]),
				).resolves.toEqual({ channel: gameB, via: 'recovered' })
				return gameB
			},
		)
		await expect(creating).rejects.toBeInstanceOf(LeaseLostError)
		await expect(ledger.ownerOf(gameB.id)).resolves.toBe('guild:game-a')
		await expect(ledger.get('guild', 'game-b')).resolves.not.toHaveProperty(
			'channelId',
		)
	})

	it('records each channel for one game only', async () => {
		const { ledger } = ledgerAt(2_000_000)
		await ledger.recordChannel('guild', 'game-a', 'shared')
		await ledger.recordChannel('guild', 'game-a', 'shared')
		await expect(
			ledger.recordChannel('guild', 'game-b', 'shared'),
		).rejects.toThrow('recorded by another game')
		await expect(ledger.get('guild', 'game-b')).resolves.toBeNull()
	})

	it("never recovers another game's recorded channel", async () => {
		const { ledger } = ledgerAt(2_000_000)
		await ledger.beginCreation('guild', 'game-a')
		const gameB = channel(at(2_000_100))
		await ledger.recordChannel('guild', 'game-b', gameB.id)
		await expect(
			locateGameChannel(ledger, key, [gameB]),
		).resolves.toBeNull()
	})

	it.each([
		['', undefined],
		[' | pluto-presentation:v2', 'sent'],
		[' | pluto-presentation:v2:unsent', 'unsent'],
	] as const)(
		'carries a pre-#742 marker topic%s into the ledger',
		async (suffix, delivery) => {
			const { ledger } = ledgerAt(2_000_000)
			const legacy = channel('legacy', {
				topic: `${legacyMarker('game-a')}${suffix}`,
			})
			const otherGame = channel('other', {
				topic: legacyMarker('game-b'),
			})
			await expect(
				locateGameChannel(ledger, key, [otherGame, legacy]),
			).resolves.toEqual({ channel: legacy, via: 'legacy' })
			const record = await ledger.get('guild', 'game-a')
			expect(record?.channelId).toBe('legacy')
			expect(record?.delivery).toBe(delivery)
		},
	)
})

describe('RedisGameChannelLedger', () => {
	it('records a send only once, for the channel it created', async () => {
		const { ledger } = ledgerAt(1_000)
		await ledger.beginCreation('guild', 'game')
		await ledger.recordChannel('guild', 'game', 'channel', 'unsent')
		await expect(ledger.markSent('guild', 'game', 'other')).rejects.toThrow(
			'requires reconciliation',
		)
		await ledger.markSent('guild', 'game', 'channel')
		await expect(
			ledger.markSent('guild', 'game', 'channel'),
		).rejects.toThrow('requires reconciliation')
		await expect(ledger.ownerOf('channel')).resolves.toBe('guild:game')
	})
})
