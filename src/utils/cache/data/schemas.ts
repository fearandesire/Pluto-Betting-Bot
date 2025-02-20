import type { ColorResolvable } from 'discord.js';
import { z } from 'zod';
import type { SportsServing } from '../../api/common/interfaces/index.js';

const channelDeletionJobDataSchema = z.object({
	channelName: z.string(),
	jobId: z.string().optional(),
});

const channelDeletionResultSchema = z.object({
	success: z.boolean(),
	channelName: z.string(),
	error: z.string().optional(),
});

export type ChannelDeletionJobData = z.infer<
	typeof channelDeletionJobDataSchema
>;

export type ChannelDeletionResult = z.infer<typeof channelDeletionResultSchema>;

export const teamRecordSchema = z.object({
	total_record: z.string(),
});

export const teamRecordsResultSchema = z.object({
	home_team: teamRecordSchema,
	away_team: teamRecordSchema,
});

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

export const channelAggregatedSchema = z
	.object({
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
		gametime: z.date().describe('Scheduled start time of the game'),
		channelname: z
			.string()
			.describe('Name of the Discord channel to be created'),
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
	})
	.describe('Enriched channel data including match odds and team information');

export const channelCreationEventSchema = z.object({
	channel: channelAggregatedSchema.describe(
		'Enriched channel data including match odds and team information',
	),
	guild: eligibleGuildData.describe(
		'Single Discord Guild data that is eligible for the channel to be created',
	),
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

/** Complete scheduled channels data schema */
export const incomingChannelDataSchema = z.object({
	channels: z.array(channelAggregatedSchema),
	guilds: z.array(eligibleGuildData),
});

export type IncomingChannelData = z.infer<typeof incomingChannelDataSchema>;

export type ChannelAggregated = z.infer<typeof channelAggregatedSchema>;
export type GuildEligibility = z.infer<typeof eligibleGuildData>;
export type ChannelCreationPayload = z.infer<typeof channelCreationEventSchema>;

export const prepareMatchEmbedSchema = z
	.object({
		favored: z.string().describe('Name of the favored team'),
		favoredTeamClr: z
			.custom<ColorResolvable>()
			.describe('Color code for the favored team'),
		home_team: z.string().describe('Name of the home team'),
		homeTeamShortName: z.string().describe('Short name of the home team'),
		away_team: z.string().describe('Name of the away team'),
		awayTeamShortName: z.string().describe('Short name of the away team'),
		bettingChanId: z.string().describe('Discord channel ID for betting'),
		header: z.string().describe('Header text for the embed'),
		sport: z.string() as z.ZodType<SportsServing>,
		records: teamRecordsResultSchema
			.nullable()
			.optional()
			.describe('Optional team records'),
	})
	.describe('Data required to prepare a match embed');

export const createChannelAndSendEmbedSchema = z
	.object({
		channel: channelAggregatedSchema,
		guild: eligibleGuildData,
		metadata: z.object({
			favoredTeamInfo: z.any().describe('Resolved team information'),
			matchImg: z.instanceof(Buffer).nullable().describe('Match image buffer'),
			headline: z
				.string()
				.nullable()
				.optional()
				.describe('Optional headline or description for the game'),
			records: teamRecordsResultSchema
				.nullable()
				.optional()
				.describe('Team records and statistics'),
		}),
	})
	.describe('Data required to create a channel and send an embed');

export type PrepareMatchEmbed = z.infer<typeof prepareMatchEmbedSchema>;
export type CreateChannelAndSendEmbed = z.infer<
	typeof createChannelAndSendEmbedSchema
>;
