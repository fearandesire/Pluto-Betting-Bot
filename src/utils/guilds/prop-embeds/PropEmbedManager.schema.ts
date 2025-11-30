import { z } from 'zod'

const guildEmojiSchema = z
	.object({
		id: z.string().describe('Discord snowflake ID of the guild emoji'),
		name: z.string().nullable().describe('Name of the emoji'),
		animated: z
			.boolean()
			.optional()
			.describe('Whether the emoji is animated'),
	})
	.describe('Schema for Discord.js GuildEmoji objects')

const emojiSchema = z
	.object({
		name: z
			.string()
			.describe('Unicode emoji character or custom emoji name'),
	})
	.describe('Schema for Discord.js Emoji objects')

const _aggregateDetailsParamsSchema = z
	.object({
		home: z
			.object({
				fullName: z
					.string()
					.describe('Full display name of the home team'),
				transformed: z
					.union([guildEmojiSchema, emojiSchema, z.string()])
					.describe('Team identifier as emoji or string'),
				shortName: z.string().describe('Abbreviated team name'),
			})
			.describe('Home team aggregate details'),
		away: z
			.object({
				fullName: z
					.string()
					.describe('Full display name of the away team'),
				transformed: z
					.union([guildEmojiSchema, emojiSchema, z.string()])
					.describe('Team identifier as emoji or string'),
				shortName: z.string().describe('Abbreviated team name'),
			})
			.describe('Away team aggregate details'),
	})
	.describe('Parameters for aggregating team details in prop embeds')
