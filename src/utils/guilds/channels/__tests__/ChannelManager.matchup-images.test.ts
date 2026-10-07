import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { ChannelType, EmbedBuilder } from 'discord.js'
import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from 'vitest'
import { createMatchupImageResolver } from '../matchup-image-resolver.js'
import {
	createFixtureAssets,
	writeFixtureManifest,
} from './matchup-image-fixtures.js'

const mocks = vi.hoisted(() => ({
	resolve: vi.fn(),
	guilds: new Map<string, any>(),
}))
vi.mock('../matchup-image-resolver.js', async (importOriginal) => ({
	...(await importOriginal<typeof import('../matchup-image-resolver.js')>()),
	resolveMatchupImage: mocks.resolve,
}))
vi.mock('../../../../index.js', () => ({
	SapDiscClient: { guilds: { cache: mocks.guilds } },
}))
vi.mock('resolve-team', () => ({
	teamResolver: { resolve: vi.fn(async () => ({ colors: ['#112233'] })) },
}))
vi.mock('../../../cache/redis-instance.js', () => ({ default: {} }))
vi.mock('../../../../lib/startup/env.js', () => ({
	default: { KH_API_URL: 'http://fixture.invalid' },
}))
vi.mock('../../../logging/WinstonLogger.js', () => ({ logger: {} }))
vi.mock('../../../bot_res/findEmoji.js', () => ({
	findEmoji: vi.fn(async () => ''),
}))

import ChannelManager from '../ChannelManager.js'

let fixture: Awaited<ReturnType<typeof createFixtureAssets>>
beforeAll(async () => {
	fixture = await createFixtureAssets()
})
afterAll(async () => {
	await fs.rm(fixture.root, { recursive: true, force: true })
})

const channel = {
	id: 'game-1',
	sport: 'nfl',
	channelname: 'patriots-at-commanders',
	away_team: 'New England Patriots',
	home_team: 'Washington Commanders',
	matchOdds: { favored: 'New England Patriots' },
}
const guild = {
	guildId: 'guild',
	gameCategoryId: 'category',
	bettingChannelId: 'bets',
}

describe('ChannelManager matchup attachments', () => {
	beforeEach(() => {
		mocks.resolve.mockReset()
		mocks.guilds.clear()
	})
	for (const method of ['create', 'resume'] as const) {
		for (const format of ['png', 'jpeg', 'none'] as const) {
			it(`${method} preserves match.jpg attachment for ${format}`, async () => {
				const image = format === 'none' ? null : fixture[format]
				const manifest = structuredClone(fixture.manifest)
				const entry = manifest.entries.find(
					(item) => item.pairKey === 'nfl:commanders:patriots',
				)!
				if (image) {
					entry.mime = format === 'png' ? 'image/png' : 'image/jpeg'
					entry.sha256 = createHash('sha256')
						.update(image)
						.digest('hex')
					entry.approval.sha256 = entry.sha256
					await fs.writeFile(
						path.join(fixture.root, entry.path),
						image,
					)
				} else
					await fs.rm(path.join(fixture.root, entry.path), {
						force: true,
					})
				await writeFixtureManifest(fixture.root, manifest)
				mocks.resolve.mockImplementation(
					createMatchupImageResolver({
						assetsRoot: fixture.root,
						report: vi.fn(),
					}),
				)
				const send = vi.fn(async (_payload: any) => undefined)
				const text = {
					id: 'text',
					type: ChannelType.GuildText,
					send,
					messages: { fetch: vi.fn(async () => []) },
				}
				const create = vi.fn(async () => text)
				mocks.guilds.set('guild', {
					channels: {
						cache: new Map<string, any>([
							['category', { type: ChannelType.GuildCategory }],
							['text', text],
						]),
						create,
					},
				})
				const input = {
					...channel,
					channelname:
						method === 'resume'
							? 'unrelated-lakers-at-knicks-garbage'
							: channel.channelname,
				}
				const manager = new ChannelManager({} as any) as any
				if (method === 'create') {
					const created = await manager.createReservedChannel(
						input,
						guild,
						{ marker: 'pluto-game:fixture' },
					)
					await created.complete()
				} else
					await manager.completeExistingChannel(input, guild, 'text')
				expect(mocks.resolve).toHaveBeenCalledWith({
					sport: 'nfl',
					awayTeam: channel.away_team,
					homeTeam: channel.home_team,
				})
				const payload = send.mock.calls[0][0]
				expect(payload.embeds[0]).toBeInstanceOf(EmbedBuilder)
				if (image) {
					expect(payload.files).toHaveLength(1)
					expect(payload.files[0].name).toBe('match.jpg')
					expect(payload.files[0].attachment).toEqual(image)
					expect(payload.embeds[0].toJSON().image).toEqual({
						url: 'attachment://match.jpg',
					})
				} else {
					expect(payload.files).toBeUndefined()
					expect(payload.embeds[0].toJSON().image).toBeUndefined()
				}
			})
		}
	}
})
