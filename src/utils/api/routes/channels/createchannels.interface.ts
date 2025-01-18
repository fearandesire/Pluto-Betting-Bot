import { z } from 'zod';
import type { SportsServing } from '../../common/interfaces/kh-pluto/kh-pluto.interface.js';

export interface IChannelAPI {
	id: string;
	sport: string;
	channelname: string;
	crontime: string;
	gametime: string;
	created: boolean;
}

export const teamRecordSchema = z.object({
	total_record: z.string(),
});

export const teamRecordsResultSchema = z.object({
	home_team: teamRecordSchema,
	away_team: teamRecordSchema,
});

export const channelMetadataSchema = z.object({
	headline: z.string().optional(),
	records: teamRecordsResultSchema,
});

export type ChannelMetadata = z.infer<typeof channelMetadataSchema>;

export interface IChannelAggregated {
	id: string;
	sport: SportsServing;
	channelname: string;
	crontime: string;
	gametime: string;
	created: boolean;
	matchOdds: {
		favored: string;
		home_team_odds: number;
		away_team_odds: number;
	};
	home_team: string;
	away_team: string;
	metadata: ChannelMetadata;
}

export interface ScheduledChannelsGuildData {
	guildId: string;
	bettingChannelId: string;
	gameCategoryId: string;
	sport: string;
	preferred_teams?: string[];
}
export interface ScheduledChannelsData {
	channels: IChannelAggregated[];
	guilds: ScheduledChannelsGuildData[];
}

export enum SportEmojis {
	nba = '🏀',
	nfl = '🏈',
}
