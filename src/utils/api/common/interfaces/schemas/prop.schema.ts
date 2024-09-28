import { z } from 'zod';
import { BettingMarketSchema } from './betting-market.schema.js';

/**
 * Enum representing the possible statuses of a prop.
 */
export const PropStatusEnum = z.enum(['pending', 'completed', 'error']);

/**
 * Schema for a prop object.
 */
export const PropSchema = z.object({
	/** Unique identifier for the prop */
	id: z.string(),
	/** Identifier for the associated event */
	event_id: z.string(),
	/** Key representing the sport */
	sport_key: z.string(),
	/** Title of the sport */
	sport_title: z.string(),
	/** Start time of the event */
	commence_time: z.string(),
	/** Name of the home team */
	home_team: z.string(),
	/** Name of the away team */
	away_team: z.string(),
	/** Key of the bookmaker */
	bookmaker_key: z.string(),
	/** Title of the bookmaker */
	bookmaker_title: z.string(),
	/** Timestamp of the last update */
	last_update: z.string(),
	/** Key representing the betting market */
	market_key: BettingMarketSchema,
	/** Price of the prop */
	price: z.string(),
	/** Point value for the prop */
	point: z.string(),
	/** Current status of the prop */
	status: PropStatusEnum,
	/** Timestamp of when the prop was created */
	created_at: z.string(),
	/** Timestamp of when the prop was last updated */
	updated_at: z.string(),
	/** Result of the prop, if available */
	result: z.string().nullable(),
	/** Description of the prop */
	description: z.string().nullable(),
	/** Name of the prop */
	name: z.string(),
	/** Array of predictions associated with the prop (for eager loading) */
	predictions: z.null().optional(),
	/** Associated event object (for eager loading) */
	event: z.null().optional(),
});

/**
 * Schema for an array of prop objects.
 */
export const PropArraySchema = z.array(PropSchema);

/**
 * Type definition for a prop object based on the PropSchema.
 */
export type PropZod = z.infer<typeof PropSchema>;

/**
 * Type definition for an array of prop objects.
 */
export type PropArray = z.infer<typeof PropArraySchema>;

/**
 * Schema for prop options.
 */
export const PropOptionsSchema = z.object({
	/** Number of days ahead to consider for props */
	daysAhead: z.number().optional(),
});

/**
 * Type definition for prop options.
 */
export type PropOptions = z.infer<typeof PropOptionsSchema>;
