import { number, object, union, z } from 'zod';
import {
	BettingMarketSchema,
	BettingMarketSchemaNonH2h,
} from './betting-market.schema.js';

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
	point: z.string().nullable(),
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

/**
 * Schema for guild configuration where prediction stats should be posted
 * Matches PropStatsGuildData DTO
 */
export const PropStatsGuildConfigSchema = z.object({
	guild_id: z
		.string()
		.describe('The ID of the guild where stats will be posted'),
	channel_id: z
		.string()
		.describe('The ID of the channel where stats will be posted'),
});

export const h2HStatsSchema = z.object({
	home: z.number(),
	away: z.number(),
});

export const overUnderStatsSchema = z.object({
	over: z.number(),
	under: z.number(),
});

// Create base type for stats that's shared between both types
const BasePropStats = z.object({
	total_predictions: z.number(),
});

// H2H specific stats
export const H2HPropStatsSchema = BasePropStats.extend({
	percentages: h2HStatsSchema,
	tallies: h2HStatsSchema,
});

// Non-H2H stats (all other market types)
export const NonH2HPropStatsSchema = BasePropStats.extend({
	percentages: overUnderStatsSchema,
	tallies: overUnderStatsSchema,
});

/**
 * Schema for prop prediction statistics
 * Part of PropEmbedsOutgoingDto
 */
export const PropPredictionStatsSchema = z.object({
	prop_id: z.string().describe('Unique identifier for the prop'),
	home_team: z.string().describe('Name of the home team'),
	away_team: z.string().describe('Name of the away team'),
	total_predictions: z
		.string()
		.describe('Total number of predictions made')
		.transform((val) => Number(val)),
	market_key: BettingMarketSchema,
	stats: z.object({
		total_predictions: z.string().transform((val) => Number(val)),
		percentages: z.union([h2HStatsSchema, overUnderStatsSchema]),
		tallies: z.union([h2HStatsSchema, overUnderStatsSchema]),
	}),
	price: z
		.string()
		.transform((val) => Number(val))
		.describe(
			"The price of the odds - if it's not a H2H market, this is present",
		)
		.nullable(),
	betting_on_label: z
		.string()
		.describe('Human-readable label for the betting value'),
	description: z
		.string()
		.nullable()
		.describe('Optional description of the prediction'),
});

/**
 * Combined schema matching PropEmbedsOutgoingDto
 */
export const PropEmbedsIncomingSchema = z.object({
	props: z
		.array(PropPredictionStatsSchema)
		.describe('Array of prop prediction statistics'),
	guilds: z
		.array(PropStatsGuildConfigSchema)
		.describe('Array of guild configurations for posting'),
});

/**
 * Type definitions
 */
export type PropPredictionStats = z.infer<typeof PropPredictionStatsSchema>;
export type PropStatsGuildConfig = z.infer<typeof PropStatsGuildConfigSchema>;
export type PropEmbedsIncoming = z.infer<typeof PropEmbedsIncomingSchema>;

// Export the discriminated union types
export type H2HPropStats = z.infer<typeof H2HPropStatsSchema>;
export type NonH2HPropStats = z.infer<typeof NonH2HPropStatsSchema>;
export type PropStats = H2HPropStats | NonH2HPropStats;
