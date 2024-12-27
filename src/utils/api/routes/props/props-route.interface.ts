import type { Prop } from '@kh-openapi';
import { z } from 'zod';
import type { PropOptions, PropZod } from '../../common/interfaces/index.js';

export const GuildChannelSchema = z.object({
	guild_id: z.string(),
	channel_id: z.string(),
	sport: z.string(),
	preferred_teams: z
		.string()
		.optional()
		.describe('Array of teams a guild is constrained to receive data for'),
});

export const GuildChannelArraySchema = z.array(GuildChannelSchema);

export type PropRaw = Omit<Prop, 'event' | 'predictions'>;

export interface ReqBodyPropsEmbedsData {
	props: PropZod[];
	guilds: { guild_id: string; channel_id: string; sport: string }[];
}

export interface ValidatedDataPropEmbeds {
	props: PropZod[];
	guildChannels: { guild_id?: string; channel_id: string; sport: string }[];
	options: PropOptions;
}
