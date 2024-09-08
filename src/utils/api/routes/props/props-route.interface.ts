import type { Prop } from "@khronos-index";
import { z } from "zod";
import { PropOptions, PropZod } from "@pluto-api-interfaces";

export const GuildChannelSchema = z.object({
	guild_id: z.string(),
	channel_id: z.string(),
})

export const GuildChannelArraySchema = z.array(GuildChannelSchema)

export type PropRaw = Omit<Prop, 'event' | 'predictions'>

export interface RequestBody {
	props: PropZod[];
	guildChannels: { guild_id: string; channel_id: string }[];
}

export interface ValidatedData {
	props: PropZod[];
	guildChannels: { guild_id: string; channel_id: string }[];
	options: PropOptions;
}