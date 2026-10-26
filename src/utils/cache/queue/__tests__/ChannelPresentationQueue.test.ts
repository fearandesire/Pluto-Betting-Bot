import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { ChannelType, Collection } from 'discord.js'
import {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from 'vitest'

const mocks = vi.hoisted(() => ({
	processors: new Map<string, any>(),
	guilds: new Map<string, any>(),
	basePath: '',
	state: {} as any,
	calls: [] as any[],
	dropNextAck: false,
	afterCreate: undefined as (() => void) | undefined,
	failNextSend: false,
	afterAssetRead: undefined as (() => void) | undefined,
}))
vi.mock('bullmq', () => ({
	Queue: class {
		async close() {}
	},
	QueueEvents: class {
		on() {}
		async close() {}
	},
	Worker: class {
		constructor(name: string, process: any) {
			mocks.processors.set(name, process)
		}
		on() {}
		async pause() {}
		async close() {}
	},
}))
vi.mock('../../../../index.js', () => ({
	SapDiscClient: { user: { id: 'bot' }, guilds: { cache: mocks.guilds } },
}))
vi.mock('../../../../lib/startup/env.js', () => ({
	default: { USE_MOCK_DATA: true },
}))
vi.mock('../../../logging/WinstonLogger.js', () => ({
	logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))
vi.mock('../../../guilds/channels/matchup-image-resolver.js', () => ({
	resolveMatchupImage: async () => {
		mocks.afterAssetRead?.()
		return null
	},
}))
vi.mock('../../../bot_res/findEmoji.js', () => ({ findEmoji: async () => '' }))
vi.mock('resolve-team', () => ({
	teamResolver: { resolve: async () => ({ colors: ['#112233'] }) },
}))
vi.mock('../../../api/Khronos/KhronosInstances.js', () => ({
	KH_API_CONFIG: {
		get basePath() {
			return mocks.basePath
		},
		headers: {},
	},
	GuildsInstance: {
		getGuildById: async () => ({
			sport: 'nba',
			config: [
				{ setting_type: 'BETTING_CHAN', setting_value: 'bets' },
				{ setting_type: 'GAMES_CATEGORY', setting_value: 'category' },
			],
		}),
	},
}))

import redisCache from '../../redis-instance.js'
import { channelCreationQueue } from '../ChannelCreationQueue.js'
import { channelPresentationQueue } from '../ChannelPresentationQueue.js'

// PostgreSQL accepts legacy provider GUIDs without RFC UUID version/variant bits.
const gameId = '11111111-1111-f111-1111-111111111111'
const guild = {
	guildId: 'guild',
	eligibleMatches: [gameId],
	sport: 'nba',
	bettingChannelId: 'bets',
	gameCategoryId: 'category',
}
const core = {
	id: gameId,
	sport: 'nba',
	created: false,
	gametime: '2026-10-20T23:00:00Z',
	channelname: 'celtics-at-pistons',
	home_team: 'Detroit Pistons',
	away_team: 'Boston Celtics',
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
}
let server: Server
let posts: any[]
let edits: any[]
beforeAll(async () => {
	server = createServer(async (request, response) => {
		mocks.calls.push({ method: request.method, url: request.url })
		response.setHeader('Content-Type', 'application/json')
		if (
			request.url !==
			`/api/khronos/v1/internal/channel-presentations/guild/${gameId}${request.method === 'POST' ? '/ack' : ''}`
		) {
			response.writeHead(404)
			response.end('{}')
			return
		}
		if (request.method === 'POST') {
			let body = ''
			for await (const chunk of request) body += chunk
			const receipt = JSON.parse(body)
			if (mocks.dropNextAck) {
				mocks.dropNextAck = false
				response.writeHead(503)
				response.end('{}')
				return
			}
			if (receipt.revision !== mocks.state.desiredRevision) {
				response.writeHead(409)
				response.end('{}')
				return
			}
			Object.assign(mocks.state, {
				channelId: receipt.channelId,
				messageId: receipt.messageId,
				appliedRevision: receipt.revision,
			})
		}
		response.end(JSON.stringify(mocks.state))
	})
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
	mocks.basePath = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})
afterAll(async () => {
	await channelCreationQueue.close()
	await channelPresentationQueue.close()
	await new Promise<void>((resolve, reject) =>
		server.close((error) => (error ? reject(error) : resolve())),
	)
})
beforeEach(() => {
	vi.useFakeTimers({ toFake: ['Date'] })
	vi.setSystemTime(new Date('2026-10-20T22:30:00Z'))
	posts = []
	edits = []
	mocks.calls.length = 0
	mocks.dropNextAck = false
	mocks.afterCreate = undefined
	mocks.failNextSend = false
	mocks.afterAssetRead = undefined
	mocks.state = {
		gameId,
		guildId: 'guild',
		desiredRevision: 1,
		appliedRevision: 0,
		desiredPresentation: structuredClone(core),
		channelId: null,
		messageId: null,
	}
	const channels = new Collection<string, any>([
		['category', { id: 'category', type: ChannelType.GuildCategory }],
	])
	mocks.guilds.set('guild', {
		channels: {
			cache: channels,
			fetch: async (id?: string) => (id ? channels.get(id) : channels),
			create: async (options: any) => {
				const messages = new Collection<string, any>()
				const channel = {
					...options,
					id: 'channel',
					type: ChannelType.GuildText,
					setTopic: async (topic: string) => {
						channel.topic = topic
						return channel
					},
					messages: {
						fetch: async (id?: any) =>
							typeof id === 'string'
								? messages.get(id)
								: messages,
					},
					send: async (payload: any) => {
						if (mocks.failNextSend) {
							mocks.failNextSend = false
							throw new Error('Discord send result unknown')
						}
						posts.push(payload)
						const message = {
							id: 'message',
							author: { id: 'bot' },
							embeds: payload.embeds.map((e: any) => e.toJSON()),
							edit: async (next: any) => {
								edits.push(next)
								message.embeds = next.embeds.map((e: any) =>
									e.toJSON(),
								)
								return message
							},
						}
						messages.set(message.id, message)
						return message
					},
				}
				channels.set(channel.id, channel)
				mocks.afterCreate?.()
				return channel
			},
		},
	})
})
describe('registered queue handlers through HTTP receipts and Discord adapter', () => {
	it('does not retry an ambiguous initial send into an empty marked channel', async () => {
		mocks.failNextSend = true
		const job = {
			data: { schemaVersion: 2, channel: core, guild },
			attemptsMade: 0,
		}
		await expect(
			mocks.processors.get('channel-creation')(job),
		).rejects.toThrow('send result unknown')
		await expect(
			mocks.processors.get('channel-creation')(job),
		).rejects.toThrow('requires reconciliation')
		expect(posts).toHaveLength(0)
		expect(mocks.state.appliedRevision).toBe(0)
		expect(mocks.guilds.get('guild').channels.cache.size).toBe(2)
	})
	it('checks the lease after asynchronous payload preparation before starting a send', async () => {
		mocks.afterCreate = () => {
			mocks.afterAssetRead = () => {
				vi.spyOn(redisCache, 'refreshIfOwned').mockResolvedValue(false)
			}
		}
		await expect(
			mocks.processors.get('channel-creation')({
				data: { schemaVersion: 2, channel: core, guild },
				attemptsMade: 0,
			}),
		).rejects.toThrow('lease was lost')
		expect(posts).toHaveLength(0)
		expect(
			mocks.guilds.get('guild').channels.cache.get('channel').topic,
		).toBe('Enjoy the game!')
		expect(
			JSON.parse(
				(await redisCache.get(
					`pluto:game-channel:v1:guild:${gameId}`,
				)) ?? '{}',
			),
		).toMatchObject({ channelId: 'channel', delivery: 'unsent' })
	})
	it('finishes a known empty channel after a post-create hold and reschedule', async () => {
		mocks.afterCreate = () => {
			mocks.state.desiredRevision = 2
			mocks.state.desiredPresentation.status = 'postponed'
			delete mocks.state.desiredPresentation.initial_odds_completion
		}
		const job = {
			data: { schemaVersion: 2, channel: core, guild },
			attemptsMade: 0,
		}
		await mocks.processors.get('channel-creation')(job)
		expect(posts).toHaveLength(0)
		expect(mocks.state.appliedRevision).toBe(0)
		mocks.afterCreate = undefined
		mocks.state.desiredRevision = 3
		mocks.state.desiredPresentation.status = 'scheduled'
		mocks.state.desiredPresentation.initial_odds_completion = {
			...core.initial_odds_completion,
			revision: 3,
		}
		await mocks.processors.get('channel-creation')(job)
		expect(posts).toHaveLength(1)
		expect(mocks.guilds.get('guild').channels.cache.size).toBe(2)
		expect(mocks.state).toMatchObject({
			appliedRevision: 3,
			channelId: 'channel',
			messageId: 'message',
		})
	})
	it('holds an active old job when authoritative state has no paid completion', async () => {
		delete mocks.state.desiredPresentation.initial_odds_completion
		await mocks.processors.get('channel-creation')({
			data: { schemaVersion: 2, channel: core, guild },
			attemptsMade: 0,
		})
		expect(posts).toHaveLength(0)
		expect(edits).toHaveLength(0)
		expect(mocks.state.appliedRevision).toBe(0)
		expect(
			mocks.calls.filter((call) => call.method === 'POST'),
		).toHaveLength(0)
	})
	it('recovers the posted card after a failed acknowledgement without posting twice', async () => {
		mocks.dropNextAck = true
		const job = {
			data: { schemaVersion: 2, channel: core, guild },
			attemptsMade: 0,
		}
		await expect(
			mocks.processors.get('channel-creation')(job),
		).rejects.toThrow()
		expect(posts).toHaveLength(1)
		expect(mocks.state.appliedRevision).toBe(0)
		await mocks.processors.get('channel-creation')(job)
		expect(posts).toHaveLength(1)
		expect(edits).toHaveLength(1)
		expect(mocks.state).toMatchObject({
			appliedRevision: 1,
			channelId: 'channel',
			messageId: 'message',
		})
		expect(posts[0].embeds[0].data.footer.text).toBe(
			'Pluto | dev. fenixforever',
		)
	})
	it('creates without prices, then edits the same card for arrival and suspension', async () => {
		await mocks.processors.get('channel-creation')({
			data: { schemaVersion: 2, channel: core, guild },
			attemptsMade: 0,
		})
		expect(posts).toHaveLength(1)
		expect(posts[0].embeds[0].data.description).not.toMatch(
			/favorite|unavailable|null|undefined|Place your bets/,
		)
		expect(mocks.state).toMatchObject({
			appliedRevision: 1,
			channelId: 'channel',
			messageId: 'message',
		})
		mocks.state.desiredRevision = 2
		mocks.state.desiredPresentation.betting = {
			state: 'available',
			matchOdds: {
				favored: 'Boston Celtics',
				home_team_odds: 150,
				away_team_odds: -175,
			},
		}
		const wake = {
			schemaVersion: 1,
			gameId,
			guildId: 'guild',
			revision: 1,
			presentation: core,
		}
		await mocks.processors.get('channel-presentation-update')({
			data: wake,
		})
		expect(edits[0].embeds[0].data.description).toContain(
			'**Boston Celtics** opens as the favorite.',
		)
		mocks.state.desiredRevision = 3
		mocks.state.desiredPresentation.betting = {
			state: 'unavailable',
			reason: 'suspended',
		}
		await mocks.processors.get('channel-presentation-update')({
			data: wake,
		})
		expect(edits[1].embeds[0].data.description).not.toMatch(
			/favorite|unavailable|null|undefined|Place your bets/,
		)
		expect(posts).toHaveLength(1)
		expect(mocks.state).toMatchObject({
			appliedRevision: 3,
			channelId: 'channel',
			messageId: 'message',
		})
		expect(
			mocks.calls.filter((call) => call.method === 'POST'),
		).toHaveLength(3)
	})
	it('rejects malformed V2 and unsupported versions before any effect', async () => {
		await expect(
			mocks.processors.get('channel-creation')({
				data: { schemaVersion: 3, channel: core, guild },
			}),
		).rejects.toThrow('Unsupported')
		await expect(
			mocks.processors.get('channel-creation')({
				data: {
					schemaVersion: 2,
					channel: { ...core, id: '1234' },
					guild,
				},
			}),
		).rejects.toThrow('Invalid job data')
		expect(mocks.calls).toHaveLength(0)
		expect(posts).toHaveLength(0)
	})
})

afterEach(() => {
	vi.restoreAllMocks()
	vi.useRealTimers()
})
