import { z } from 'zod'

const MAX_SNOWFLAKE = 18_446_744_073_709_551_615n // unsigned 64-bit

export const discordSnowflakeSchema = z
	.string()
	.refine(
		(value) => /^\d{17,20}$/.test(value) && BigInt(value) <= MAX_SNOWFLAKE,
		{ message: 'Invalid Discord snowflake' },
	)

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
