import * as KhronosTypes from '@pluto-khronos/types'
import { z } from 'zod'

const notificationEntryBaseSchema = z.object({
	userId: z.string().min(1),
	betId: z.number().int().nonnegative(),
	/** Optional until Khronos includes guild context on bet-result callbacks. */
	guildId: z.string().min(1).optional(),
	guild_id: z.string().min(1).optional(),
})

const legacyPushSchema = z.object({
	userid: z.string().min(1),
	amount: z.number().nonnegative(),
	betid: z.number().int().nonnegative(),
	team: z.string().min(1),
})

const typedPushSchema = notificationEntryBaseSchema.extend({
	result: z.object({
		team: z.string().min(1),
		betAmount: z.number().nonnegative(),
		refunded: z.number().finite().nonnegative(),
	}),
})

const fallbackNotificationBetResultsSchema = z.object({
	winners: z
		.array(
			notificationEntryBaseSchema.extend({
				result: z.object({
					team: z.string().min(1),
					betAmount: z.number().nonnegative(),
					payout: z.number().finite().nonnegative(),
					profit: z.number().finite(),
					newBalance: z.number().finite().optional(),
					oldBalance: z.number().finite().optional(),
				}),
			}),
		)
		.nullable(),
	losers: z
		.array(
			notificationEntryBaseSchema.extend({
				result: z.object({
					team: z.string().min(1),
					betAmount: z.number().nonnegative(),
				}),
			}),
		)
		.nullable(),
	pushes: z.array(z.union([typedPushSchema, legacyPushSchema])).optional(),
})

const dailyPropOutcomeSchema = z.object({
	outcome_uuid: z.string().uuid(),
	outcome_name: z.string().min(1),
	price: z.number().int(),
})

const boardGameMarketsSchema = z.object({
	h2h: z
		.object({ away: dailyPropOutcomeSchema, home: dailyPropOutcomeSchema })
		.optional(),
	totals: z
		.object({
			point: z.number(),
			over: dailyPropOutcomeSchema,
			under: dailyPropOutcomeSchema,
		})
		.optional(),
})

const propBoardSchema = z.object({
	event_id: z.string().min(1),
	over_outcome_uuids: z.array(z.string().uuid()).min(1).max(4),
	game: boardGameMarketsSchema.optional(),
})

const fallbackDailyPropsPayloadSchema = z.object({
	props: z.array(
		z.object({
			event_id: z.string().min(1),
			commence_time: z.string().min(1),
			home_team: z.string().min(1),
			away_team: z.string().min(1),
			sport_title: z.string().min(1),
			market_key: z.string().min(1),
			bookmaker_key: z.string().min(1),
			description: z.string().min(1),
			point: z.number(),
			over: dailyPropOutcomeSchema,
			under: dailyPropOutcomeSchema,
		}),
	),
	guilds: z.array(
		z.object({
			guild_id: z.string().min(1),
			channel_id: z.string().min(1),
			sport: z.string().min(1),
		}),
	),
	boards: z.array(propBoardSchema).min(1).optional(),
})

/**
 * Mirrors the published board rules: every pair sits on exactly one board of
 * its own game, and a game block's outcomes repeat nothing else in the post.
 */
function refineBoards(payload: DailyPropsPayload, ctx: z.RefinementCtx) {
	if (!payload.boards) return
	const byOver = new Map(
		payload.props.map((prop) => [prop.over.outcome_uuid, prop]),
	)
	const seen = new Set<string>()
	const outcomes = new Set(
		payload.props.flatMap((prop) => [
			prop.over.outcome_uuid,
			prop.under.outcome_uuid,
		]),
	)
	const issue = (path: (string | number)[], message: string) =>
		ctx.addIssue({ code: 'custom', path, message })
	payload.boards.forEach((board, boardIndex) => {
		board.over_outcome_uuids.forEach((outcomeUuid, pairIndex) => {
			const path = ['boards', boardIndex, 'over_outcome_uuids', pairIndex]
			const prop = byOver.get(outcomeUuid)
			if (!prop)
				return issue(
					path,
					'Board outcome is not an over outcome in props',
				)
			if (prop.event_id !== board.event_id)
				issue(path, 'Board outcome belongs to another game')
			if (seen.has(outcomeUuid))
				issue(path, 'Board outcome appears on more than one board')
			seen.add(outcomeUuid)
		})
		const game = board.game
		if (!game) return
		if (!game.h2h && !game.totals)
			issue(['boards', boardIndex, 'game'], 'Game block is empty')
		for (const outcomeUuid of [
			game.h2h?.away.outcome_uuid,
			game.h2h?.home.outcome_uuid,
			game.totals?.over.outcome_uuid,
			game.totals?.under.outcome_uuid,
		]) {
			if (!outcomeUuid) continue
			if (outcomes.has(outcomeUuid))
				issue(['boards', boardIndex, 'game'], 'Game outcome repeats')
			outcomes.add(outcomeUuid)
		}
	})
	if (seen.size !== payload.props.length)
		issue(['boards'], 'Every prop must belong to exactly one board')
}

const fallbackPropSettledNotificationSchema = z.object({
	outcome_uuid: z.string().uuid(),
	result: z.enum(['won', 'lost', 'push', 'void']),
	winning_side_display: z.string().optional(),
	actual_value: z.number().finite().nullable().optional(),
	market_key: z.string().min(1),
	description: z.string().min(1),
	point: z.number().finite().nullable().optional(),
	tallies: z.object({
		correct: z.number().int().nonnegative(),
		incorrect: z.number().int().nonnegative(),
		total: z.number().int().nonnegative(),
	}),
	messages: z
		.array(
			z.object({
				guild_id: z.string().min(1),
				channel_id: z.string().min(1),
				message_id: z.string().min(1),
			}),
		)
		.min(1),
})

const fallbackParlayLegNotificationSchema = z.object({
	id: z.string().min(1),
	event_id: z.string().min(1),
	outcome_uuid: z.string().min(1),
	selection_display: z.string().min(1),
	market_key: z.string().min(1),
	odds_american: z.number().int(),
	point: z.number().nullable(),
	commence_time: z.coerce.date(),
	result: z.enum(['pending', 'won', 'lost', 'push', 'void']),
	home_team: z.string().min(1).optional(),
	away_team: z.string().min(1).optional(),
})

const fallbackParlayResultNotificationSchema = z.object({
	kind: z.enum(['won', 'lost', 'push_refunded', 'busted']),
	parlay_id: z.string().uuid(),
	user_id: z.string().min(1),
	guild_id: z.string().min(1).optional(),
	stake: z.number().finite().nonnegative(),
	combined_odds_american: z.number().int(),
	payout: z.number().finite().nonnegative().optional(),
	actual_payout: z.number().finite().nonnegative().nullable(),
	refund_amount: z.number().finite().nonnegative().optional(),
	old_balance: z.number().finite().optional(),
	new_balance: z.number().finite().optional(),
	legs: z.array(fallbackParlayLegNotificationSchema).min(1),
})

const fallbackH2hResultNotificationSchema = z.object({
	user_id: z.string().min(1),
	guild_id: z.string().min(1).optional(),
	bet_id: z.number().int().nonnegative(),
	event_id: z.string().min(1),
	outcome_uuid: z.string().uuid(),
	result: z.enum(['won', 'lost']),
	team: z.string().min(1),
	stake: z.number().finite().nonnegative(),
	payout: z.number().finite().nonnegative(),
	profit: z.number().finite(),
	old_balance: z.number().finite().optional(),
	new_balance: z.number().finite().optional(),
})

export type NotificationBetResults = z.infer<
	typeof fallbackNotificationBetResultsSchema
>
export type DailyPropsPayload = z.infer<typeof fallbackDailyPropsPayloadSchema>
export type BoardGameMarkets = z.infer<typeof boardGameMarketsSchema>
export type PropSettledNotification = z.infer<
	typeof fallbackPropSettledNotificationSchema
>
export type ParlayResultNotification = z.infer<
	typeof fallbackParlayResultNotificationSchema
>
export type H2hResultNotification = z.infer<
	typeof fallbackH2hResultNotificationSchema
>

type SharedPayloadExports = {
	notificationBetResultsSchema?: z.ZodType<NotificationBetResults>
	dailyPropsPayloadSchema?: z.ZodType<DailyPropsPayload>
	propSettledNotificationSchema?: z.ZodType<PropSettledNotification>
	parlayResultNotificationSchema?: z.ZodType<ParlayResultNotification>
	h2hResultNotificationSchema?: z.ZodType<H2hResultNotification>
}

const sharedPayloadExports = KhronosTypes as unknown as SharedPayloadExports

const legacyNotificationBetResultsProbe: NotificationBetResults = {
	winners: [],
	losers: [],
	pushes: [{ userid: 'probe', amount: 1, betid: 1, team: 'probe-team' }],
}

function isUsableSchema<T>(
	schema: z.ZodType<T> | undefined,
): schema is z.ZodType<T> {
	return schema !== undefined && schema._def?.type !== 'never'
}

function supportsLegacyNotificationPushes(
	schema: z.ZodType<NotificationBetResults> | undefined,
): schema is z.ZodType<NotificationBetResults> {
	return (
		isUsableSchema(schema) &&
		schema.safeParse(legacyNotificationBetResultsProbe).success
	)
}

/**
 * Consume the published Khronos contracts when available while keeping strict
 * compatibility bridges for deployments that have not yet received the schema
 * releases backing these payloads.
 */
export const notificationBetResultsSchema = supportsLegacyNotificationPushes(
	sharedPayloadExports.notificationBetResultsSchema,
)
	? sharedPayloadExports.notificationBetResultsSchema
	: fallbackNotificationBetResultsSchema

const probeOutcome = (suffix: string, name: string) => ({
	outcome_uuid: `00000000-0000-4000-8000-0000000000${suffix}`,
	outcome_name: name,
	price: -110,
})

const boardGameProbe: DailyPropsPayload = {
	props: [
		{
			event_id: 'probe',
			commence_time: '2026-01-01T00:00:00Z',
			home_team: 'Home',
			away_team: 'Away',
			sport_title: 'NBA',
			market_key: 'player_points',
			bookmaker_key: 'probe',
			description: 'Probe',
			point: 1.5,
			over: probeOutcome('01', 'Over'),
			under: probeOutcome('02', 'Under'),
		},
	],
	guilds: [{ guild_id: 'probe', channel_id: 'probe', sport: 'nba' }],
	boards: [
		{
			event_id: 'probe',
			over_outcome_uuids: [probeOutcome('01', 'Over').outcome_uuid],
			game: {
				totals: {
					point: 200.5,
					over: probeOutcome('03', 'Over'),
					under: probeOutcome('04', 'Under'),
				},
			},
		},
	],
}

/** Published schemas before board game blocks strip `boards[].game`. */
function keepsBoardGames(
	schema: z.ZodType<DailyPropsPayload> | undefined,
): schema is z.ZodType<DailyPropsPayload> {
	if (!isUsableSchema(schema)) return false
	const parsed = schema.safeParse(boardGameProbe)
	return parsed.success && parsed.data.boards?.[0]?.game !== undefined
}

export const dailyPropsPayloadSchema = keepsBoardGames(
	sharedPayloadExports.dailyPropsPayloadSchema,
)
	? sharedPayloadExports.dailyPropsPayloadSchema
	: fallbackDailyPropsPayloadSchema.superRefine(refineBoards)

export const propSettledNotificationSchema = isUsableSchema(
	sharedPayloadExports.propSettledNotificationSchema,
)
	? sharedPayloadExports.propSettledNotificationSchema
	: fallbackPropSettledNotificationSchema

export const parlayResultNotificationSchema = isUsableSchema(
	sharedPayloadExports.parlayResultNotificationSchema,
)
	? sharedPayloadExports.parlayResultNotificationSchema
	: fallbackParlayResultNotificationSchema

export const h2hResultNotificationSchema = isUsableSchema(
	sharedPayloadExports.h2hResultNotificationSchema,
)
	? sharedPayloadExports.h2hResultNotificationSchema
	: fallbackH2hResultNotificationSchema
