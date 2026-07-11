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

export type NotificationBetResults = z.infer<
	typeof fallbackNotificationBetResultsSchema
>
export type DailyPropsPayload = z.infer<typeof fallbackDailyPropsPayloadSchema>

type SharedPayloadExports = {
	betNotificationWonSchema?: unknown
	notificationBetResultsSchema?: z.ZodType<NotificationBetResults>
	dailyPropsPayloadSchema?: z.ZodType<DailyPropsPayload>
}

const sharedPayloadExports = KhronosTypes as unknown as SharedPayloadExports

/**
 * Use the published shared schemas when available. The fallback is a strict
 * compatibility bridge for deployments whose package bump precedes TF-939's
 * schema release; it can be removed once all supported versions export the
 * new contracts.
 */
export const notificationBetResultsSchema =
	(sharedPayloadExports.betNotificationWonSchema
		? sharedPayloadExports.notificationBetResultsSchema
		: fallbackNotificationBetResultsSchema) ??
	fallbackNotificationBetResultsSchema

export const dailyPropsPayloadSchema =
	sharedPayloadExports.dailyPropsPayloadSchema ??
	fallbackDailyPropsPayloadSchema
