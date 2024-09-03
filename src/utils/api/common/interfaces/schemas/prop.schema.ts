import { z } from 'zod'
import { BettingMarketSchema } from './betting-market.schema'

export const PropSchema = z.object({
	id: z.string(),
	event_id: z.string(),
	sport_key: z.string(),
	sport_title: z.string(),
	commence_time: z.date(),
	home_team: z.string(),
	away_team: z.string(),
	bookmaker_key: z.string(),
	bookmaker_title: z.string(),
	last_update: z.date(),
	market_key: BettingMarketSchema,
	price: z.number(),
	point: z.number().nullable(),
	status: z.enum(['pending', 'completed', 'error']),
	created_at: z.date(),
	updated_at: z.date(),
	result: z.string().nullable(),
	description: z.string(),
})

export const PropArraySchema = z.array(PropSchema)

export type Prop = z.infer<typeof PropSchema>
export type PropArray = z.infer<typeof PropArraySchema>
