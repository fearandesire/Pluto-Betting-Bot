import type { Prop } from '@khronos-index'
import { z } from 'zod'

export const GuildChannelSchema = z.object({
	guild_id: z.string(),
	prop_channel_id: z.string(),
})

export const GuildChannelArraySchema = z.array(GuildChannelSchema)

export type PropRaw = Omit<Prop, 'event' | 'predictions'>
