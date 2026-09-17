import { container } from '@sapphire/framework'
import { PermissionFlagsBits } from 'discord.js'
import { logger } from '../../../logging/WinstonLogger.js'
import { GuildsInstance } from '../../Khronos/KhronosInstances.js'
import type { GuildModeratorLookupResponse } from '../moderation-payload-schemas.js'

const DEFAULT_TIMEOUT_MS = 5_000
const UNKNOWN_MEMBER_ERROR_CODE = 10_007

type ReportedPermission = 'KICK_MEMBERS' | 'BAN_MEMBERS'

interface ModerationMember {
	permissions: {
		has(permission: bigint): boolean
	}
}

export interface ModerationGuild {
	id: string
	name: string
	ownerId: string
	members: {
		fetch(userId: string): Promise<ModerationMember>
	}
}

interface GuildModeratorLookupOptions {
	getServedGuilds?: () => Promise<ModerationGuild[]>
	timeoutMs?: number
	now?: () => Date
}

export class ModerationLookupUnavailableError extends Error {
	readonly code = 'MODERATION_LOOKUP_UNAVAILABLE'
	readonly cause: unknown

	constructor(cause?: unknown) {
		super('Guild moderator lookup is unavailable')
		this.name = 'ModerationLookupUnavailableError'
		this.cause = cause
	}
}

function isUnknownMemberError(error: unknown): boolean {
	if (typeof error !== 'object' || error === null) return false

	const discordError = error as {
		code?: number | string
		httpStatus?: number
		status?: number
	}

	return (
		discordError.status === 404 ||
		discordError.httpStatus === 404 ||
		Number(discordError.code) === UNKNOWN_MEMBER_ERROR_CODE
	)
}

async function getConfiguredDiscordGuilds(): Promise<ModerationGuild[]> {
	const configuredGuilds = (await GuildsInstance.getAllGuilds()).filter(
		(guild) => (guild.config?.length ?? 0) > 0,
	)

	return configuredGuilds.map((configuredGuild) => {
		const discordGuild = container.client.guilds.cache.get(
			configuredGuild.guild_id,
		)
		if (!discordGuild) {
			throw new ModerationLookupUnavailableError()
		}

		return {
			id: discordGuild.id,
			name: discordGuild.name,
			ownerId: discordGuild.ownerId,
			members: {
				fetch: async (userId: string) =>
					await discordGuild.members.fetch(userId),
			},
		}
	})
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
	return new Promise<T>((resolve, reject) => {
		const timeout = setTimeout(
			() => reject(new ModerationLookupUnavailableError()),
			timeoutMs,
		)

		promise.then(
			(value) => {
				clearTimeout(timeout)
				resolve(value)
			},
			(error) => {
				clearTimeout(timeout)
				reject(error)
			},
		)
	})
}

export class GuildModeratorLookupService {
	private readonly getServedGuilds: () => Promise<ModerationGuild[]>
	private readonly timeoutMs: number
	private readonly now: () => Date

	constructor(options: GuildModeratorLookupOptions = {}) {
		this.getServedGuilds =
			options.getServedGuilds ?? getConfiguredDiscordGuilds
		this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
		this.now = options.now ?? (() => new Date())
	}

	async lookup(userId: string): Promise<GuildModeratorLookupResponse> {
		const startedAt = performance.now()
		let guildCount = 0
		let status: 'success' | 'unavailable' = 'success'

		try {
			const response = await withTimeout(
				this.lookupWithoutTimeout(userId),
				this.timeoutMs,
			)
			guildCount = response.guilds.length
			return response
		} catch (error) {
			status = 'unavailable'
			if (error instanceof ModerationLookupUnavailableError) throw error
			throw new ModerationLookupUnavailableError(error)
		} finally {
			logger.info('Guild moderator lookup completed', {
				event: 'moderation.lookup.completed',
				userId,
				guildCount,
				durationMs: Math.round(performance.now() - startedAt),
				status,
			})
		}
	}

	private async lookupWithoutTimeout(
		userId: string,
	): Promise<GuildModeratorLookupResponse> {
		const servedGuilds = await this.getServedGuilds()
		const matches = await Promise.all(
			servedGuilds.map(async (guild) => {
				let member: ModerationMember
				try {
					member = await guild.members.fetch(userId)
				} catch (error) {
					if (isUnknownMemberError(error)) return null
					throw error
				}

				const permissions: ReportedPermission[] = []
				if (
					guild.ownerId === userId ||
					member.permissions.has(PermissionFlagsBits.KickMembers)
				) {
					permissions.push('KICK_MEMBERS')
				}
				if (
					guild.ownerId === userId ||
					member.permissions.has(PermissionFlagsBits.BanMembers)
				) {
					permissions.push('BAN_MEMBERS')
				}

				if (permissions.length === 0) return null
				return {
					guild_id: guild.id,
					name: guild.name,
					permissions,
				}
			}),
		)

		return {
			user_id: userId,
			guilds: matches.filter(
				(guild): guild is NonNullable<typeof guild> => guild !== null,
			),
			checked_at: this.now().toISOString(),
		}
	}
}
