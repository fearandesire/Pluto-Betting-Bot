import { z } from 'zod'
import {
	BasketballPlayerPropMarketSchema,
	BettingMarketSchema,
	MainBettingMarketSchema,
	NBAAlternatePlayerPropMarketSchema,
	NFLAlternatePlayerPropMarketSchema,
	NFLPlayerPropMarketSchema,
	SportKeysSchema,
	SupportedSportsSchema,
} from './betting-market.schema.js'

/**
 * @description Schema for the betting markets we support. There are others, but these are the only ones we have implemented.
 */
export const bettingMarketSchema = BettingMarketSchema

/**
 * @description Schema for individual betting outcomes.
 */
export const outcomeSchema = z.object({
	name: z.string(),
	price: z.number(),
	point: z.number().optional(),
})

/**
 * @description Schema for supported bookmaker keys.
 */
export const bookmakerKeySchema = z.union([
	z.literal('betonlineag'),
	z.literal('betmgm'),
	z.literal('betrivers'),
	z.literal('betus'),
	z.literal('bovada'),
	z.literal('draftkings'),
	z.literal('fanduel'),
	z.literal('lowvig'),
	z.literal('mybookieag'),
	z.literal('pointsbetus'),
	z.literal('superbook'),
	z.literal('twinspires'),
	z.literal('unibet_us'),
	z.literal('williamhill_us'),
	z.literal('wynnbet'),
	z.literal('betparx'),
	z.literal('espnbet'),
	z.literal('fliff'),
	z.literal('sisportsbook'),
	z.literal('tipico_us'),
	z.literal('windcreek'),
])

/**
 * @description Schema for market data within a bookmaker.
 */
export const marketDataSchema = z.object({
	key: bettingMarketSchema,
	outcomes: z.array(outcomeSchema),
})

/**
 * @description Schema for bookmaker information.
 */
export const bookmakerSchema = z.object({
	key: z.string(),
	title: z.string(),
	last_update: z.date(),
	markets: z.array(marketDataSchema),
})

/**
 * @description Schema for the standard API response structure.
 */
export const kHApiResponseSchema = z.object({
	statusCode: z.number(),
	message: z.string(),
})

/**
 * @description Schema for successful API responses with optional data.
 */
export const kHApiResponseSuccessSchema = kHApiResponseSchema.extend({
	data: z.union([z.any(), z.string()]).optional(),
	sport: z.string().optional(),
	chanId: z.union([z.number(), z.string()]).optional(),
})

/**
 * @description Schema for individual score information.
 */
export const iScoreSchema = z.object({
	name: z.string(),
	score: z.string(),
})

export const sportKeysSchema = SportKeysSchema

export const supportedSportsSchema = SupportedSportsSchema

export const mainBettingMarketSchema = MainBettingMarketSchema

export const nFLPlayerPropMarketSchema = NFLPlayerPropMarketSchema

export const nFLAlternatePlayerPropMarketSchema =
	NFLAlternatePlayerPropMarketSchema

export const basketballPlayerPropMarketSchema = BasketballPlayerPropMarketSchema

export const nBAAlternatePlayerPropMarketSchema =
	NBAAlternatePlayerPropMarketSchema

/**
 * @description Schema for the full score information returned by the Odds API.
 */
export const iScoreFullSchema = z.object({
	id: z.string(),
	sport_key: z.string(),
	sport_title: z.string(),
	commence_time: z.string(),
	completed: z.boolean(),
	home_team: z.string(),
	away_team: z.string(),
	scores: z.array(iScoreSchema).nullable(),
	last_update: z.date().nullable(),
})

/**
 * @description Schema for the game information returned by the Odds API.
 */
export const iOddsAPIGameSchema = z.object({
	id: z.string(),
	sport_key: sportKeysSchema,
	sport_title: supportedSportsSchema,
	commence_time: z.string(),
	home_team: z.string(),
	away_team: z.string(),
	bookmakers: z.array(bookmakerSchema),
})

export type KHApiResponse = z.infer<typeof kHApiResponseSchema>

export type KHApiResponseSuccess = z.infer<typeof kHApiResponseSuccessSchema>

export type IScore = z.infer<typeof iScoreSchema>

export type SportKeys = z.infer<typeof sportKeysSchema>

export type SupportedSports = z.infer<typeof supportedSportsSchema>

export type MainBettingMarket = z.infer<typeof mainBettingMarketSchema>

export type NFLPlayerPropMarket = z.infer<typeof nFLPlayerPropMarketSchema>

export type NFLAlternatePlayerPropMarket = z.infer<
	typeof nFLAlternatePlayerPropMarketSchema
>

export type BasketballPlayerPropMarket = z.infer<
	typeof basketballPlayerPropMarketSchema
>

export type NBAAlternatePlayerPropMarket = z.infer<
	typeof nBAAlternatePlayerPropMarketSchema
>

export type BettingMarket = z.infer<typeof bettingMarketSchema>

export type Outcome = z.infer<typeof outcomeSchema>

export type BookmakerKey = z.infer<typeof bookmakerKeySchema>

export type IScoreFull = z.infer<typeof iScoreFullSchema>

export type MarketData = z.infer<typeof marketDataSchema>

export type Bookmaker = z.infer<typeof bookmakerSchema>

export type IOddsAPIGame = z.infer<typeof iOddsAPIGameSchema>
