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

/**
 * Interface for team record information
 */

export interface TeamRecord {
	total_record: string;
}

/**
 * Interface for the return value of extractTeamRecordsFromScoreboard
 */
export interface TeamRecordsResult {
	home_team: TeamRecord;
	away_team: TeamRecord;
}

export const channelMetadataSchema = z.object({
	headline: z.string().optional(),
	records: z
		.object({
			home_team: z.string(),
			away_team: z.string(),
		})
		.optional(),
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
