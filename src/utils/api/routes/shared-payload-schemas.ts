import * as KhronosTypes from '@pluto-khronos/types'
import { z } from 'zod'

const notificationEntryBaseSchema = z.object({
	userId: z.string().min(1),
	betId: z.number().int().nonnegative(),
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

export type NotificationBetResults = z.infer<
	typeof fallbackNotificationBetResultsSchema
>
export type DailyPropsPayload = z.infer<typeof fallbackDailyPropsPayloadSchema>
export type PropSettledNotification = z.infer<
	typeof fallbackPropSettledNotificationSchema
>

type SharedPayloadExports = {
	notificationBetResultsSchema?: z.ZodType<NotificationBetResults>
	dailyPropsPayloadSchema?: z.ZodType<DailyPropsPayload>
	propSettledNotificationSchema?: z.ZodType<PropSettledNotification>
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
