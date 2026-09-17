import { z } from 'zod'

export const discordSnowflakeSchema = z.string().regex(/^\d{17,22}$/)

export const guildModeratorLookupResponseSchema = z.object({
	user_id: discordSnowflakeSchema,
	guilds: z.array(
		z.object({
			guild_id: discordSnowflakeSchema,
			name: z.string().min(1),
			permissions: z.array(z.enum(['KICK_MEMBERS', 'BAN_MEMBERS'])),
		}),
	),
	checked_at: z.iso.datetime(),
})

export type GuildModeratorLookupResponse = z.infer<
	typeof guildModeratorLookupResponseSchema
>
