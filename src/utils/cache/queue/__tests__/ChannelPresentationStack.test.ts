import { setTimeout as delay } from 'node:timers/promises'
import { ChannelType, Collection } from 'discord.js'
import { describe, expect, it, vi } from 'vitest'

interface StackFixture {
	basePath: string
	apiKey: string
	gameId: string
	guildId: string
	redisHost: string
	redisPort: number
	categoryId: string
	bettingChannelId: string
	sport: string
	homeTeam: string
	awayTeam: string
}

const fixture = vi.hoisted(() => ({
	config: process.env.PLUTO_CHANNEL_STACK_FIXTURE
		? (JSON.parse(process.env.PLUTO_CHANNEL_STACK_FIXTURE) as StackFixture)
		: undefined,
	guilds: new Map<string, any>(),
}))

// Only the Discord SDK and optional metadata/assets are fixtures. HTTP, Redis,
// BullMQ, receipt persistence and the registered production consumers stay real.
vi.mock('../../../../index.js', () => ({
	SapDiscClient: {
		user: { id: 'stack-bot' },
		guilds: { cache: fixture.guilds },
	},
}))
vi.mock('../../../../lib/startup/env.js', () => ({
	default: {
		USE_MOCK_DATA: false,
		R_HOST: fixture.config?.redisHost,
		R_PORT: fixture.config?.redisPort,
		R_PASS: undefined,
	},
}))
vi.mock('../../../logging/WinstonLogger.js', () => ({
	logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))
vi.mock('../../../guilds/channels/matchup-image-resolver.js', () => ({
	resolveMatchupImage: async () => null,
}))
vi.mock('../../../bot_res/findEmoji.js', () => ({ findEmoji: async () => '' }))
vi.mock('resolve-team', () => ({
	teamResolver: { resolve: async () => ({ colors: ['#112233'] }) },
}))
vi.mock('../../../api/Khronos/KhronosInstances.js', () => ({
	KH_API_CONFIG: {
		basePath: fixture.config?.basePath,
		headers: { 'x-api-key': fixture.config?.apiKey },
	},
	GuildsInstance: {
		getGuildById: async () => ({
			sport: fixture.config?.sport,
			config: [
				{
					setting_type: 'BETTING_CHAN',
					setting_value: fixture.config?.bettingChannelId,
				},
				{
					setting_type: 'GAMES_CATEGORY',
					setting_value: fixture.config?.categoryId,
				},
			],
		}),
	},
}))

describe.skipIf(!fixture.config)(
	'isolated cross-service channel consumer',
	() => {
		it('uses real queues and receipts across outage, lost ACK, restart, odds arrival and postponement', async () => {
			const config = fixture.config!
			const loopback = new Set(['127.0.0.1', 'localhost', '[::1]', '::1'])
			const url = new URL(config.basePath)
			if (
				url.protocol !== 'http:' ||
				!loopback.has(url.hostname) ||
				url.username ||
				url.password ||
				!loopback.has(config.redisHost) ||
				!Number.isInteger(config.redisPort) ||
				config.redisPort < 1 ||
				config.redisPort > 65535 ||
				!config.apiKey
			)
				throw new Error(
					'Channel stack verification requires isolated loopback endpoints',
				)

			const posts: any[] = []
			const edits: any[] = []
			let createdChannels = 0
			const channels = new Collection<string, any>([
				[
					config.categoryId,
					{ id: config.categoryId, type: ChannelType.GuildCategory },
				],
			])
			fixture.guilds.set(config.guildId, {
				channels: {
					cache: channels,
					fetch: async (id?: string) =>
						id ? channels.get(id) : channels,
					create: async (options: any) => {
						createdChannels++
						const messages = new Collection<string, any>()
						const channel = {
							...options,
							id: 'discord-channel-1',
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
								posts.push(payload)
								const message = {
									id: 'discord-message-1',
									author: { id: 'stack-bot' },
									embeds: payload.embeds.map((embed: any) =>
										embed.toJSON(),
									),
									edit: async (next: any) => {
										edits.push(next)
										message.embeds = next.embeds.map(
											(embed: any) => embed.toJSON(),
										)
										return message
									},
								}
								messages.set(message.id, message)
								return message
							},
						}
						channels.set(channel.id, channel)
						return channel
					},
				},
			})

			const redisEnv = {
				R_HOST: config.redisHost,
				R_PORT: String(config.redisPort),
				R_DB: '0',
				R_PASS: '',
			}
			const previousEnv = Object.fromEntries(
				Object.keys(redisEnv).map((key) => [key, process.env[key]]),
			)
			Object.assign(process.env, redisEnv)
			let creation: any
			let updates: any
			let cache: any
			let events: any
			const start = async () => {
				creation = (await import('../ChannelCreationQueue.js'))
					.channelCreationQueue
				updates = (await import('../ChannelPresentationQueue.js'))
					.channelPresentationQueue
				cache = (await import('../../redis-instance.js')).default
				await Promise.all([
					creation.queue.waitUntilReady(),
					updates.queue.waitUntilReady(),
				])
			}
			const stop = async () => {
				await Promise.all([creation?.close(), updates?.close()])
				await cache?.quit()
				creation = updates = cache = undefined
			}
			const control = async (name: string, method = 'POST') => {
				const response = await fetch(
					`${config.basePath}/__fixture/${name}`,
					{
						method,
						headers: { 'x-channel-stack-key': config.apiKey },
						signal: AbortSignal.timeout(30_000),
					},
				)
				if (!response.ok)
					throw new Error(
						`Stack fixture ${name} failed (${response.status})`,
					)
				return response.json() as Promise<any>
			}
			const receipt = async (minimumRevision: number) => {
				const deadline = Date.now() + 25_000
				while (Date.now() < deadline) {
					const response = await fetch(
						`${config.basePath}/api/khronos/v1/internal/channel-presentations/${config.guildId}/${config.gameId}`,
						{
							headers: { 'x-api-key': config.apiKey },
							signal: AbortSignal.timeout(5_000),
						},
					)
					if (response.ok) {
						const state = (await response.json()) as any
						if (
							state.messageId &&
							state.desiredRevision >= minimumRevision &&
							state.appliedRevision === state.desiredRevision
						)
							return state
					}
					await delay(100)
				}
				throw new Error(
					'Real channel stack did not persist its Discord receipt',
				)
			}
			const neutral = (description: string) =>
				expect(description).not.toMatch(
					/favorite|place your bets|unavailable|null|undefined/i,
				)

			try {
				await start()
				await control('run')
				const initial = await receipt(1)
				expect(initial).toMatchObject({
					channelId: 'discord-channel-1',
					messageId: 'discord-message-1',
				})
				expect(createdChannels).toBe(1)
				expect(posts).toHaveLength(1)
				expect(edits).toHaveLength(1)
				neutral(posts[0].embeds[0].data.description)
				expect(posts[0].embeds[0].data.footer.text).toBe(
					'Pluto | dev. fenixforever',
				)
				expect(await control('stats', 'GET')).toMatchObject({
					eventCount: 1,
					outcomeCount: 0,
					paidCalls: 0,
					providerReferenceCount: 1,
					channelCount: 1,
					presentationCount: 1,
					successLogCount: 1,
					droppedAcknowledgements: 1,
				})

				// A consumer-module restart keeps no in-process receipt or reservation state.
				await stop()
				vi.resetModules()
				await start()
				await control('markets')
				const priced = await receipt(initial.desiredRevision + 1)
				expect(priced.desiredPresentation.betting.state).toBe(
					'available',
				)
				expect(
					edits[edits.length - 1].embeds[0].data.description,
				).toContain('opens as the favorite.')
				expect(
					edits[edits.length - 1].embeds[0].data.description,
				).toContain('Place your bets')
				expect(posts).toHaveLength(1)
				await control('concurrent')
				await control('postpone')
				const postponed = await receipt(priced.desiredRevision + 1)
				expect(postponed.desiredPresentation.status).toBe('postponed')
				const finalDescription =
					edits[edits.length - 1].embeds[0].data.description
				expect(finalDescription).toContain('Postponed')
				expect(finalDescription).not.toContain('<t:')
				neutral(finalDescription)

				const { QueueEvents } = await import('bullmq')
				events = new QueueEvents('channel-presentation-update', {
					connection: {
						host: config.redisHost,
						port: config.redisPort,
					},
				})
				await events.waitUntilReady()
				const editsBeforeReplay = edits.length
				const replay = await updates.queue.add('stale-priced-wakeup', {
					schemaVersion: 1,
					gameId: config.gameId,
					guildId: config.guildId,
					revision: priced.desiredRevision,
					presentation: priced.desiredPresentation,
				})
				await replay.waitUntilFinished(events, 10_000)
				expect(edits).toHaveLength(editsBeforeReplay)
				expect(posts).toHaveLength(1)
				expect(createdChannels).toBe(1)
				expect(await receipt(postponed.desiredRevision)).toMatchObject({
					channelId: initial.channelId,
					messageId: initial.messageId,
					appliedRevision: postponed.desiredRevision,
				})
				expect(await control('stats', 'GET')).toMatchObject({
					eventCount: 1,
					outcomeCount: 2,
					providerReferenceCount: 2,
					financialStatus: 'scheduled',
					channelCount: 1,
					presentationCount: 1,
					successLogCount: 1,
					droppedAcknowledgements: 1,
				})
			} finally {
				await events?.close()
				await stop()
				for (const [key, value] of Object.entries(previousEnv)) {
					if (value === undefined) delete process.env[key]
					else process.env[key] = value
				}
			}
		}, 120_000)
	},
)
