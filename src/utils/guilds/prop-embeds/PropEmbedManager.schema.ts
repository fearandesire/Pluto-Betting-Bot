import { z } from 'zod'

const guildEmojiSchema = z.any()

const emojiSchema = z.any()

const _aggregateDetailsParamsSchema = z.object({
	home: z.object({
		fullName: z.string(),
		transformed: z.union([guildEmojiSchema, emojiSchema, z.string()]),
		shortName: z.string(),
	}),
	away: z.object({
		fullName: z.string(),
		transformed: z.union([guildEmojiSchema, emojiSchema, z.string()]),
		shortName: z.string(),
	}),
})
