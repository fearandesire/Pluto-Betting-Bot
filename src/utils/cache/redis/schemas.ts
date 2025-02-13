import { z } from 'zod';
import type { SportsServing } from '../../api/common/interfaces/index.js';

export const teamRecordSchema = z.object({
	total_record: z.string(),
});

export const teamRecordsResultSchema = z.object({
	home_team: teamRecordSchema,
	away_team: teamRecordSchema,
});

export type TeamRecord = z.infer<typeof teamRecordSchema>;
export type TeamRecordsResult = z.infer<typeof teamRecordsResultSchema>;

export const channelDeletionEventSchema = z.object({
	channelIds: z
		.array(z.string())
		.describe('Array of channel IDs to be deleted from Discord'),
	metadata: z
		.object({
			publishedAt: z
				.date()
				.describe('Timestamp when the deletion event was published'),
			eventId: z
				.string()
				.describe('Unique identifier for tracking the deletion event'),
		})
		.describe('Metadata associated with the channel deletion event'),
});

export const channelsAggregatedSchema = z.object({
	id: z
		.string()
		.describe(
			'Unique identifier for the channel, matches the associated match ID',
		),
	sport: z
		.string()
		.describe(
			'Sport type identifier (e.g., NBA, NFL) for the game channel',
		) as z.ZodType<SportsServing>,
	created: z
		.boolean()
		.describe('Flag indicating whether the Discord channel has been created'),
	gametime: z.string().describe('ISO 8061 Scheduled start time of the game'),
	channelname: z.string().describe('Name of the Discord channel to be created'),
	matchOdds: z
		.object({
			favored: z
				.string()
				.describe('Name of the team favored to win based on betting odds'),
			home_team_odds: z.number().describe('Betting odds for the home team'),
			away_team_odds: z.number().describe('Betting odds for the away team'),
		})
		.describe('Betting odds information for the match'),
	home_team: z.string().describe('Name of the home team'),
	away_team: z.string().describe('Name of the away team'),
	metadata: z
		.object({
			headline: z
				.string()
				.nullable()
				.describe('Optional headline or description for the game'),
			records: teamRecordsResultSchema
				.nullable()
				.describe('Team records and statistics from ESPN'),
		})
		.optional()
		.nullable()
		.describe('Additional metadata about the teams and game'),
});

export const eligibleGuildData = z
	.object({
		guildId: z.string().describe('Discord guild (server) ID'),
		eligibleMatches: z
			.array(z.string())
			.describe(
				'Array of match IDs that the guild is eligible to receive channels for',
			),
		bettingChannelId: z
			.string()
			.describe('ID of the designated betting channel in the guild'),
		gameCategoryId: z
			.string()
			.describe('ID of the category where game channels will be created'),
		sport: z.string().describe('Sport type configured for this guild'),
		preferredTeams: z
			.array(z.string())
			.optional()
			.describe(
				'Optional list of teams the guild wants to prioritize for channel creation',
			),
	})
	.describe('Data regarding the guild that is eligible for a channel creation');

export const channelCreationEventSchema = z.object({
	channel: channelsAggregatedSchema.describe(
		'Enriched channel data including match odds and team information',
	),
	eligibleGuilds: z
		.array(eligibleGuildData)
		.describe('List of Discord guilds eligible for receiving this channel'),
	metadata: z
		.object({
			publishedAt: z
				.date()
				.describe('Timestamp when the creation event was published'),
			eventId: z
				.string()
				.describe('Unique identifier for tracking the creation event'),
		})
		.describe('Metadata associated with the channel creation event'),
});

export type ChannelsAggregated = z.infer<typeof channelsAggregatedSchema>;
export type GuildEligibility = z.infer<typeof eligibleGuildData>;
export type ChannelCreationPayload = z.infer<typeof channelCreationEventSchema>;
