import { z } from "zod";
import { BettingMarketSchema } from "./betting-market.schema.js";

export const PropStatusEnum = z.enum(['pending', 'completed', 'error'])

export const PropSchema = z.object({
	id: z.string(),
	event_id: z.string(),
	sport_key: z.string(),
	sport_title: z.string(),
	commence_time: z.string(),
	home_team: z.string(),
	away_team: z.string(),
	bookmaker_key: z.string(),
	bookmaker_title: z.string(),
	last_update: z.string(),
	market_key: BettingMarketSchema,
	price: z.string(),
	point: z.string().nullable(),
	status: PropStatusEnum,
	created_at: z.string(),
	updated_at: z.string(),
	result: z.string().nullable(),
	description: z.string().nullable(),
	name: z.string(),
})

export const PropArraySchema = z.array(PropSchema)

export type Prop = z.infer<typeof PropSchema>
export type PropArray = z.infer<typeof PropArraySchema>
