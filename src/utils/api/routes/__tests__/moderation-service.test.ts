import { PermissionFlagsBits } from 'discord.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getAllGuilds, guildCache, logger } = vi.hoisted(() => ({
	getAllGuilds: vi.fn(),
	guildCache: new Map<string, unknown>(),
	logger: { info: vi.fn() },
}))

vi.mock('../../../logging/WinstonLogger.js', () => ({ logger }))
vi.mock('../../Khronos/KhronosInstances.js', () => ({
	GuildsInstance: { getAllGuilds },
}))
vi.mock('@sapphire/framework', () => ({
	container: { client: { guilds: { cache: guildCache } } },
}))

import {
	GuildModeratorLookupService,
	type ModerationGuild,
	ModerationLookupUnavailableError,
} from '../moderation/moderation-service.js'

const USER_ID = '123456789012345678'

function guild(options: {
	id: string
	name: string
	ownerId?: string
	permissions?: bigint[]
	error?: unknown
}): ModerationGuild {
	return {
		id: options.id,
		name: options.name,
		ownerId: options.ownerId ?? '999999999999999999',
		members: {
			fetch: vi.fn(async () => {
				if (options.error) throw options.error
				const permissions = new Set(options.permissions ?? [])
				return {
					permissions: {
						has: (permission: bigint) =>
							permissions.has(permission),
					},
				}
			}),
		},
	}
}

describe('GuildModeratorLookupService', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		guildCache.clear()
	})

	it('returns only the guild where the member can kick members', async () => {
		const servedGuilds = [
			guild({
				id: '111111111111111111',
				name: 'Moderated Guild',
				permissions: [PermissionFlagsBits.KickMembers],
			}),
			guild({ id: '222222222222222222', name: 'Regular Guild' }),
		]
		const service = new GuildModeratorLookupService({
			getServedGuilds: async () => servedGuilds,
			now: () => new Date('2026-09-17T12:00:00.000Z'),
		})

		await expect(service.lookup(USER_ID)).resolves.toEqual({
			user_id: USER_ID,
			guilds: [
				{
					guild_id: '111111111111111111',
					name: 'Moderated Guild',
					permissions: ['KICK_MEMBERS'],
				},
			],
			checked_at: '2026-09-17T12:00:00.000Z',
		})
		expect(logger.info).toHaveBeenCalledTimes(1)
		expect(logger.info).toHaveBeenCalledWith(
			'Guild moderator lookup completed',
			expect.objectContaining({
				userId: USER_ID,
				guildCount: 1,
				durationMs: expect.any(Number),
			}),
		)
	})

	it('considers only Discord guilds with a Khronos guild config', async () => {
		const configuredGuild = guild({
			id: '111111111111111111',
			name: 'Configured Guild',
			permissions: [PermissionFlagsBits.BanMembers],
		})
		const unconfiguredGuild = guild({
			id: '222222222222222222',
			name: 'Unconfigured Guild',
			permissions: [PermissionFlagsBits.KickMembers],
		})
		guildCache.set(configuredGuild.id, configuredGuild)
		guildCache.set(unconfiguredGuild.id, unconfiguredGuild)
		getAllGuilds.mockResolvedValue([
			{ guild_id: configuredGuild.id, config: [{}] },
			{ guild_id: unconfiguredGuild.id, config: [] },
		])
		const service = new GuildModeratorLookupService()

		const result = await service.lookup(USER_ID)

		expect(result.guilds).toEqual([
			{
				guild_id: configuredGuild.id,
				name: configuredGuild.name,
				permissions: ['BAN_MEMBERS'],
			},
		])
		expect(configuredGuild.members.fetch).toHaveBeenCalledWith(USER_ID)
		expect(unconfiguredGuild.members.fetch).not.toHaveBeenCalled()
	})

	it('returns an empty list for a non-moderator', async () => {
		const service = new GuildModeratorLookupService({
			getServedGuilds: async () => [
				guild({ id: '111111111111111111', name: 'Regular Guild' }),
			],
		})

		const result = await service.lookup(USER_ID)

		expect(result.guilds).toEqual([])
	})

	it('grants both reported permissions to the guild owner', async () => {
		const service = new GuildModeratorLookupService({
			getServedGuilds: async () => [
				guild({
					id: '111111111111111111',
					name: 'Owned Guild',
					ownerId: USER_ID,
				}),
			],
		})

		const result = await service.lookup(USER_ID)

		expect(result.guilds[0]?.permissions).toEqual([
			'KICK_MEMBERS',
			'BAN_MEMBERS',
		])
	})

	it('treats a Discord 404 as an unknown member for that guild', async () => {
		const service = new GuildModeratorLookupService({
			getServedGuilds: async () => [
				guild({
					id: '111111111111111111',
					name: 'Missing Member',
					error: { status: 404 },
				}),
			],
		})

		const result = await service.lookup(USER_ID)

		expect(result.guilds).toEqual([])
	})

	it('fails the entire lookup when any member fetch has a non-404 error', async () => {
		const service = new GuildModeratorLookupService({
			getServedGuilds: async () => [
				guild({
					id: '111111111111111111',
					name: 'Available Guild',
					permissions: [PermissionFlagsBits.BanMembers],
				}),
				guild({
					id: '222222222222222222',
					name: 'Unavailable Guild',
					error: { status: 500 },
				}),
			],
		})

		await expect(service.lookup(USER_ID)).rejects.toBeInstanceOf(
			ModerationLookupUnavailableError,
		)
	})

	it('bounds the complete lookup to the configured timeout', async () => {
		const service = new GuildModeratorLookupService({
			getServedGuilds: async () =>
				await new Promise<ModerationGuild[]>(() => undefined),
			timeoutMs: 5,
		})

		await expect(service.lookup(USER_ID)).rejects.toBeInstanceOf(
			ModerationLookupUnavailableError,
		)
	})
})
