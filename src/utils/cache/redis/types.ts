import type { ChannelCreationPayload } from './schemas.js';

// Define all available Redis channels
export enum RedisChannel {
	CHANNEL_CREATION = 'channel.creation',
	USER_UPDATE = 'user.update',
	GUILD_UPDATE = 'guild.update',
	BET_PLACED = 'bet.placed',
	BET_SETTLED = 'bet.settled',
}

export interface UserUpdatePayload {
	userId: string;
	guildId: string;
	updatedAt: string;
	changes: {
		field: string;
		oldValue: unknown;
		newValue: unknown;
	}[];
}

export interface GuildUpdatePayload {
	guildId: string;
	updatedAt: string;
	changes: {
		field: string;
		oldValue: unknown;
		newValue: unknown;
	}[];
}

export interface BetPlacedPayload {
	betId: string;
	userId: string;
	amount: number;
	odds: number;
	placedAt: string;
	type: 'SINGLE' | 'MULTI';
}

export interface BetSettledPayload {
	betId: string;
	userId: string;
	settledAt: string;
	status: 'WIN' | 'LOSS' | 'VOID';
	payout?: number;
}

// Map channel to their respective payload types
export type ChannelPayloadMap = {
	[RedisChannel.CHANNEL_CREATION]: ChannelCreationPayload;
	// ? all unused for now
	[RedisChannel.USER_UPDATE]: UserUpdatePayload;
	[RedisChannel.GUILD_UPDATE]: GuildUpdatePayload;
	[RedisChannel.BET_PLACED]: BetPlacedPayload;
	[RedisChannel.BET_SETTLED]: BetSettledPayload;
};
