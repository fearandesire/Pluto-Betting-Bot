import { z } from 'zod';
import type { SportsServing } from '../../common/interfaces/kh-pluto/kh-pluto.interface.js';

/** Basic channel API response schema */
export const channelAPISchema = z.object({
	id: z.string(),
	sport: z.string(),
	channelname: z.string(),
	crontime: z.string(),
	gametime: z.string(),
	created: z.boolean(),
});

export type IChannelAPI = z.infer<typeof channelAPISchema>;

/** Team record information schema */
export const teamRecordSchema = z.object({
	total_record: z.string(),
});

/** Combined team records result schema */
export const teamRecordsResultSchema = z.object({
	home_team: teamRecordSchema,
	away_team: teamRecordSchema,
});

/** Channel metadata schema containing headline and team records */
export const channelMetadataSchema = z.object({
	headline: z.string().optional().nullable(),
	records: teamRecordsResultSchema.optional().nullable(),
});

export type ChannelMetadata = z.infer<typeof channelMetadataSchema>;

/** Match odds information schema */
export const matchOddsSchema = z.object({
	favored: z.string(),
	home_team_odds: z.number(),
	away_team_odds: z.number(),
});

/** Aggregated channel information schema with detailed match data */
export const channelAggregatedSchema = z.object({
	id: z.string(),
	sport: z.string() as z.ZodType<SportsServing>,
	channelname: z.string(),
	crontime: z.string(),
	gametime: z.string(),
	created: z.boolean(),
	matchOdds: matchOddsSchema,
	home_team: z.string(),
	away_team: z.string(),
	metadata: channelMetadataSchema.optional(),
});

export type IChannelAggregated = z.infer<typeof channelAggregatedSchema>;

/** Guild-specific scheduled channels configuration schema */
export const scheduledChannelsGuildSchema = z.object({
	guildId: z.string(),
	eligibleMatches: z
		.array(z.string())
		.describe('Channel IDs that are eligible to be created for this guild'),
	bettingChannelId: z.string(),
	gameCategoryId: z.string(),
	sport: z.string(),
	preferred_teams: z.array(z.string()).optional().nullable(),
});

export type ScheduledChannelsGuildData = z.infer<
	typeof scheduledChannelsGuildSchema
>;

/** Complete scheduled channels data schema */
export const scheduledChannelsDataSchema = z.object({
	channels: z.array(channelAggregatedSchema),
	guilds: z.array(scheduledChannelsGuildSchema),
});

export type ScheduledChannelsData = z.infer<typeof scheduledChannelsDataSchema>;

/** Sport emoji mappings */
export const sportEmojisSchema = z.enum(['nba', 'nfl']);

export enum SportEmojis {
	nba = '🏀',
	nfl = '🏈',
}
