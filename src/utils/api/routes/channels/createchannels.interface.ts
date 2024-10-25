import type { SportsServing } from '../../common/interfaces/kh-pluto/kh-pluto.interface.js';

export interface IChannelAPI {
	id: string;
	sport: string;
	channelname: string;
	crontime: string;
	gametime: string;
	created: boolean;
}

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
	matchData: {
		headline: string;
	};
}

export interface ScheduledChannelsGuildData {
	guildId: string;
	bettingChannelId: string;
	gameCategoryId: string;
	sport: string;
}
export interface ScheduledChannelsData {
	channels: IChannelAggregated[];
	guilds: ScheduledChannelsGuildData[];
}

export enum SportEmojis {
	nba = '🏀',
	nfl = '🏈',
}
