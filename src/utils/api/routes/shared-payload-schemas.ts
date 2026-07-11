import * as KhronosTypes from '@pluto-khronos/types'
import { z } from 'zod'

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

export type DailyPropsPayload = z.infer<typeof fallbackDailyPropsPayloadSchema>
export type PropSettledNotification = z.infer<
	typeof fallbackPropSettledNotificationSchema
>

type SharedPayloadExports = {
	dailyPropsPayloadSchema?: z.ZodType<DailyPropsPayload>
	propSettledNotificationSchema?: z.ZodType<PropSettledNotification>
}

const sharedPayloadExports = KhronosTypes as unknown as SharedPayloadExports

function isUsableSchema<T>(
	schema: z.ZodType<T> | undefined,
): schema is z.ZodType<T> {
	return schema !== undefined && schema._def?.type !== 'never'
}

/**
 * Consume the published Khronos contracts when available while keeping a
 * strict compatibility bridge for deployments that have not received the
 * TF-939/TF-952 package release yet.
 */
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
