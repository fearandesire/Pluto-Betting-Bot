import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../../index.js', () => ({
	SapDiscClient: { guilds: { cache: new Map() } },
}))
vi.mock('../../../../lib/startup/env.js', () => ({
	default: { USE_MOCK_DATA: true },
}))
vi.mock('../../../logging/WinstonLogger.js', () => ({
	logger: { info: vi.fn(), warn: vi.fn() },
}))
vi.mock('../channel-presentation-client.js', () => ({
	ChannelPresentationClient: class {},
}))

import {
	type ChannelPresentationState,
	channelAggregatedV2Schema,
} from '../../../cache/data/channel-presentation-contract.js'
import { InMemoryRedis } from '../../../cache/redis-instance.js'
import {
	ChannelPresentationService,
	type PresentationDiscord,
	type PresentationStore,
} from '../ChannelPresentationService.js'
import { RedisPresentationLock } from '../channel-presentation-lock.js'

const gameId = '00000000-0000-4000-8000-000000000001'
const guild = {
	guildId: 'guild',
	eligibleMatches: [gameId],
	sport: 'nba',
	bettingChannelId: 'bets',
	gameCategoryId: 'category',
}
const game = () =>
	channelAggregatedV2Schema.parse({
		id: gameId,
		sport: 'nba',
		created: false,
		channelname: 'celtics-at-pistons',
		home_team: 'Detroit Pistons',
		away_team: 'Boston Celtics',
		gametime: '2026-10-20T23:00:00Z',
		status: 'scheduled',
		schedule_provider: 'espn',
		schedule_observed_at: '2026-10-20T22:00:00Z',
		schedule_snapshot_ref: 'fixture-accepted-snapshot',
		betting: { state: 'unavailable', reason: 'no_markets' },
		initial_odds_completion: {
			revision: 1,
			completion_id: '00000000-0000-4000-8000-000000000002',
			event_id: gameId,
			sport: 'basketball_nba',
			market: 'h2h',
			completed: true,
			status: 'confirmed_empty',
			completed_at: '2026-10-20T22:29:00Z',
		},
	})
let state: ChannelPresentationState
let store: PresentationStore
let discord: PresentationDiscord
let channelExists: boolean
let messageExists: boolean
let writes: Array<{ messageId?: string; state: string }>
let service: ChannelPresentationService
beforeEach(() => {
	vi.useFakeTimers({ toFake: ['Date'] })
	vi.setSystemTime(new Date('2026-10-20T22:30:00Z'))
	state = {
		gameId,
		guildId: 'guild',
		desiredRevision: 1,
		appliedRevision: 0,
		desiredPresentation: game(),
		channelId: null,
		messageId: null,
	}
	channelExists = false
	messageExists = false
	writes = []
	store = {
		load: vi.fn(async () => structuredClone(state)),
		guild: vi.fn(async () => guild),
		ack: vi.fn(async (_guild, _game, receipt) => {
			if (receipt.revision !== state.desiredRevision)
				throw new Error('Stale acknowledgement')
			Object.assign(state, {
				appliedRevision: receipt.revision,
				channelId: receipt.channelId,
				messageId: receipt.messageId,
			})
		}),
	}
	discord = {
		findChannel: vi.fn(async () => (channelExists ? 'channel' : null)),
		create: vi.fn(async () => {
			channelExists = true
			return 'channel'
		}),
		findMessage: vi.fn(async () => (messageExists ? 'message' : null)),
		write: vi.fn(async (_guild, _channel, presentation, messageId) => {
			writes.push({ messageId, state: presentation.betting.state })
			messageExists = true
			return 'message'
		}),
	}
	service = new ChannelPresentationService(
		store,
		discord,
		new RedisPresentationLock(new InMemoryRedis()),
	)
})
describe('durable presentation delivery', () => {
	it('holds an old unpriced creation until a paid completion is proven', async () => {
		delete state.desiredPresentation.initial_odds_completion
		await service.apply('guild', gameId, true)
		expect(discord.create).not.toHaveBeenCalled()
		expect(discord.write).not.toHaveBeenCalled()
		expect(store.ack).not.toHaveBeenCalled()
		expect(state.appliedRevision).toBe(0)
	})
	it.each([
		{ revision: 2 },
		{ event_id: '00000000-0000-4000-8000-000000000003' },
		{ sport: 'americanfootball_nfl' },
		{ completed_at: '2026-10-20T22:30:01Z' },
		{ completed_at: '2026-10-20T22:14:59Z' },
		{ status: 'unknown' },
		{ status: 'available' },
		{ completed: false },
		{ completion_id: '' },
		{ market: 'spreads' },
	])('holds unproven initial fallback: %j', async (patch) => {
		Object.assign(state.desiredPresentation.initial_odds_completion!, patch)
		await service.apply('guild', gameId, true)
		expect(discord.create).not.toHaveBeenCalled()
		expect(discord.write).not.toHaveBeenCalled()
		expect(store.ack).not.toHaveBeenCalled()
	})
	it.each(['confirmed_empty', 'unavailable', 'blocked'] as const)(
		'accepts a completed %s decision for this initial revision',
		async (status) => {
			state.desiredPresentation.initial_odds_completion!.status = status
			await service.apply('guild', gameId, true)
			expect(discord.create).toHaveBeenCalledTimes(1)
			expect(state.appliedRevision).toBe(1)
		},
	)
	it('rechecks completion expiry after asynchronous Discord discovery', async () => {
		state.desiredPresentation.initial_odds_completion!.completed_at =
			'2026-10-20T22:15:01Z'
		vi.mocked(discord.findChannel).mockImplementationOnce(async () => {
			vi.setSystemTime(new Date('2026-10-20T22:30:02Z'))
			return null
		})
		await service.apply('guild', gameId, true)
		expect(discord.create).not.toHaveBeenCalled()
		expect(discord.write).not.toHaveBeenCalled()
	})
	it('does not require an empty-odds proof for available prices', async () => {
		delete state.desiredPresentation.initial_odds_completion
		state.desiredPresentation.betting = {
			state: 'available',
			matchOdds: {
				favored: 'Boston Celtics',
				home_team_odds: 150,
				away_team_odds: -175,
			},
		}
		await service.apply('guild', gameId, true)
		expect(discord.create).toHaveBeenCalledTimes(1)
		expect(writes).toEqual([{ state: 'available', messageId: undefined }])
	})
	it('discards a loaded empty snapshot when prices arrive before creation', async () => {
		vi.mocked(discord.findChannel).mockImplementationOnce(async () => {
			state.desiredRevision = 2
			state.desiredPresentation.betting = {
				state: 'available',
				matchOdds: {
					favored: 'Boston Celtics',
					home_team_odds: 150,
					away_team_odds: -175,
				},
			}
			delete state.desiredPresentation.initial_odds_completion
			return null
		})
		await service.apply('guild', gameId, true)
		expect(writes).toEqual([{ state: 'available', messageId: undefined }])
		expect(state.appliedRevision).toBe(2)
	})
	it('holds a loaded snapshot when its replacement has no completed proof', async () => {
		vi.mocked(discord.findChannel).mockImplementationOnce(async () => {
			state.desiredRevision = 2
			delete state.desiredPresentation.initial_odds_completion
			return null
		})
		await service.apply('guild', gameId, true)
		expect(discord.create).not.toHaveBeenCalled()
		expect(discord.write).not.toHaveBeenCalled()
		expect(store.ack).not.toHaveBeenCalled()
	})
	it('rechecks the delivery lease after the authoritative state read', async () => {
		vi.mocked(store.load)
			.mockImplementationOnce(async () => structuredClone(state))
			.mockImplementationOnce(async () => {
				vi.setSystemTime(new Date('2026-10-20T22:36:00Z'))
				return structuredClone(state)
			})
		await expect(service.apply('guild', gameId, true)).rejects.toThrow(
			'lease was lost',
		)
		expect(discord.create).not.toHaveBeenCalled()
		expect(discord.write).not.toHaveBeenCalled()
	})
	it('creates one neutral post, then edits the same post when odds arrive and disappear', async () => {
		await service.apply('guild', gameId, true)
		expect(state).toMatchObject({
			appliedRevision: 1,
			channelId: 'channel',
			messageId: 'message',
		})
		state.desiredRevision++
		state.desiredPresentation.betting = {
			state: 'available',
			matchOdds: {
				favored: 'Boston Celtics',
				home_team_odds: 150,
				away_team_odds: -175,
			},
		}
		await service.apply('guild', gameId, false)
		state.desiredRevision++
		state.desiredPresentation.betting = {
			state: 'unavailable',
			reason: 'suspended',
		}
		await service.apply('guild', gameId, false)
		await service.apply('guild', gameId, true)
		expect(discord.create).toHaveBeenCalledTimes(1)
		expect(writes).toEqual([
			{ messageId: undefined, state: 'unavailable' },
			{ messageId: 'message', state: 'available' },
			{ messageId: 'message', state: 'unavailable' },
		])
	})
	it('rechecks current team preferences before creating a queued channel', async () => {
		vi.mocked(store.guild)
			.mockResolvedValueOnce(guild)
			.mockResolvedValueOnce({
				...guild,
				eligibleMatches: [],
				preferredTeams: ['Miami Heat'],
			})

		await service.apply('guild', gameId, true)

		expect(store.guild).toHaveBeenCalledTimes(2)
		expect(discord.create).not.toHaveBeenCalled()
		expect(discord.write).not.toHaveBeenCalled()
		expect(store.ack).not.toHaveBeenCalled()
	})
	it('recovers a successful send after lost acknowledgement without another post', async () => {
		vi.mocked(store.ack).mockRejectedValueOnce(new Error('Response lost'))
		await expect(service.apply('guild', gameId, true)).rejects.toThrow(
			'Response lost',
		)
		await service.apply('guild', gameId, true)
		expect(discord.create).toHaveBeenCalledTimes(1)
		expect(writes.map((w) => w.messageId)).toEqual([undefined, 'message'])
		expect(state.appliedRevision).toBe(1)
	})
	it('holds ambiguous or deleted messages rather than posting a replacement', async () => {
		channelExists = true
		await expect(service.apply('guild', gameId, true)).rejects.toThrow(
			'reconciliation',
		)
		expect(discord.write).not.toHaveBeenCalled()
	})
	it('never creates a channel from an update without a receipt', async () => {
		await expect(service.apply('guild', gameId, false)).rejects.toThrow(
			'no confirmed channel',
		)
		expect(discord.create).not.toHaveBeenCalled()
	})
	it.each(['live', 'final', 'postponed', 'cancelled'] as const)(
		'never creates a %s game',
		async (status) => {
			state.desiredPresentation.status = status
			await service.apply('guild', gameId, true)
			expect(discord.create).not.toHaveBeenCalled()
		},
	)
	it.each([
		{ gametime: new Date('2026-10-21T01:00:00Z') },
		{ gametime: new Date('2026-10-20T22:29:00Z') },
		{ schedule_observed_at: undefined },
		{ schedule_observed_at: '2026-10-20T16:29:59Z' },
		{ schedule_observed_at: '2026-10-20T22:30:01Z' },
		{ schedule_snapshot_ref: undefined },
	])(
		'holds rescheduled, expired and unproven creation: %j',
		async (patch) => {
			Object.assign(state.desiredPresentation, patch)
			await service.apply('guild', gameId, true)
			expect(discord.create).not.toHaveBeenCalled()
		},
	)
	it('rejects simultaneous create/update work across independent service instances', async () => {
		const lock = new RedisPresentationLock(new InMemoryRedis())
		let release!: () => void
		let entered!: () => void
		const started = new Promise<void>((resolve) => {
			entered = resolve
		})
		vi.mocked(discord.write).mockImplementationOnce(async () => {
			entered()
			await new Promise<void>((resolve) => {
				release = resolve
			})
			messageExists = true
			return 'message'
		})
		const first = new ChannelPresentationService(
			store,
			discord,
			lock,
		).apply('guild', gameId, true)
		await started
		await expect(
			new ChannelPresentationService(store, discord, lock).apply(
				'guild',
				gameId,
				false,
			),
		).rejects.toThrow('busy')
		release()
		await first
		expect(discord.create).toHaveBeenCalledTimes(1)
	})
	it('uses authoritative current state after an older wake-up and retries a concurrent revision', async () => {
		vi.mocked(discord.write).mockImplementationOnce(async () => {
			messageExists = true
			state.desiredRevision = 2
			state.desiredPresentation.betting = {
				state: 'unavailable',
				reason: 'suspended',
			}
			return 'message'
		})
		await expect(service.apply('guild', gameId, true)).rejects.toThrow(
			'Stale',
		)
		state.desiredPresentation.initial_odds_completion!.revision = 2
		await service.apply('guild', gameId, true)
		expect(state.appliedRevision).toBe(2)
		expect(discord.create).toHaveBeenCalledTimes(1)
		expect(writes).toEqual([{ messageId: 'message', state: 'unavailable' }])
	})
})

afterEach(() => vi.useRealTimers())
