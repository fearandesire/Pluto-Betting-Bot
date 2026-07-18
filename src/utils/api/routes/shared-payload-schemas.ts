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
})

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

export type NotificationBetResults = z.infer<
	typeof fallbackNotificationBetResultsSchema
>
export type DailyPropsPayload = z.infer<typeof fallbackDailyPropsPayloadSchema>
export type PropSettledNotification = z.infer<
	typeof fallbackPropSettledNotificationSchema
>
export type ParlayResultNotification = z.infer<
	typeof fallbackParlayResultNotificationSchema
>

type SharedPayloadExports = {
	notificationBetResultsSchema?: z.ZodType<NotificationBetResults>
	dailyPropsPayloadSchema?: z.ZodType<DailyPropsPayload>
	propSettledNotificationSchema?: z.ZodType<PropSettledNotification>
	parlayResultNotificationSchema?: z.ZodType<ParlayResultNotification>
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

export const dailyPropsPayloadSchema = isUsableSchema(
	sharedPayloadExports.dailyPropsPayloadSchema,
)
	? sharedPayloadExports.dailyPropsPayloadSchema
	: fallbackDailyPropsPayloadSchema

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
