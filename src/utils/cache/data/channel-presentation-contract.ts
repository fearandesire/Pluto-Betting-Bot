// Additive V2 mirror for consumer-first rollout. Keep parity with @pluto-khronos/types.

import {
	channelAggregatedSchema as legacyChannelSchema,
	channelCreationEventSchema as legacyCreationSchema,
} from '@pluto-khronos/types'
import { z } from 'zod'

const matchOddsSchema = legacyChannelSchema.shape.matchOdds
const sportsServingSchema = legacyChannelSchema.shape.sport
const channelAggregatedSchema = legacyChannelSchema
const matchMetadataSchema = legacyChannelSchema.shape.metadata.unwrap().unwrap()
const channelEligibleGuildSchema = legacyCreationSchema.shape.guild
const bullMqMetadataSchema = legacyCreationSchema.shape.metadata
	.unwrap()
	.unwrap()
/** V2 is additive: persisted V1 jobs retain their original required prices. */
export const channelBettingSchema = z.discriminatedUnion('state', [
	z.strictObject({
		state: z.literal('unavailable'),
		reason: z.enum(['no_markets', 'invalid_markets', 'suspended']),
	}),
	z.strictObject({
		state: z.literal('available'),
		matchOdds: matchOddsSchema.extend({
			favored: z.string().trim().min(1),
			home_team_odds: z
				.number()
				.finite()
				.refine((price) => price !== 0),
			away_team_odds: z
				.number()
				.finite()
				.refine((price) => price !== 0),
		}),
	}),
])

export const channelAggregatedV2Schema = z
	.object({
		id: z.string().uuid(),
		sport: sportsServingSchema,
		created: z.boolean(),
		gametime: channelAggregatedSchema.shape.gametime,
		channelname: z.string().trim().min(1),
		home_team: z.string().trim().min(1),
		away_team: z.string().trim().min(1),
		status: z.enum([
			'scheduled',
			'live',
			'final',
			'postponed',
			'cancelled',
		]),
		betting: channelBettingSchema,
		schedule_provider: z.enum(['espn', 'odds_api']).optional(),
		schedule_observed_at: z.string().datetime({ offset: true }).optional(),
		schedule_snapshot_ref: z.string().trim().min(1).optional(),
		metadata: matchMetadataSchema.nullable().optional(),
	})
	.superRefine((channel, context) => {
		if (channel.home_team === channel.away_team) {
			context.addIssue({
				code: 'custom',
				path: ['away_team'],
				message: 'A game requires two distinct teams',
			})
		}
		if (
			channel.betting.state === 'available' &&
			![channel.home_team, channel.away_team].includes(
				channel.betting.matchOdds.favored,
			)
		) {
			context.addIssue({
				code: 'custom',
				path: ['betting', 'matchOdds', 'favored'],
				message: 'Favorite must belong to this game',
			})
		}
	})

export const channelCreationEventV2Schema = z.object({
	schemaVersion: z.literal(2),
	channel: channelAggregatedV2Schema,
	guild: channelEligibleGuildSchema,
	metadata: bullMqMetadataSchema.nullable().optional(),
})

const presentationRevisionSchema = z
	.number()
	.int()
	.positive()
	.max(Number.MAX_SAFE_INTEGER)

/** BullMQ queue name: channel-presentation-update. */
export const channelPresentationUpdateV1Schema = z
	.object({
		schemaVersion: z.literal(1),
		gameId: z.string().uuid(),
		guildId: z.string().min(1),
		revision: presentationRevisionSchema,
		presentation: channelAggregatedV2Schema,
	})
	.refine((update) => update.gameId === update.presentation.id, {
		path: ['presentation', 'id'],
		message: 'Presentation must belong to the canonical game',
	})

/** Body for the authenticated completion endpoint; IDs are bound by its route. */
export const channelPresentationReceiptSchema = z.strictObject({
	revision: presentationRevisionSchema,
	channelId: z.string().min(1),
	messageId: z.string().min(1),
})

/** Durable desired state and Discord references returned to the bot. */
export const channelPresentationStateSchema = z
	.object({
		gameId: z.string().uuid(),
		guildId: z.string().min(1),
		desiredRevision: presentationRevisionSchema,
		appliedRevision: z
			.number()
			.int()
			.nonnegative()
			.max(Number.MAX_SAFE_INTEGER),
		desiredPresentation: channelAggregatedV2Schema,
		channelId: z.string().min(1).nullable(),
		messageId: z.string().min(1).nullable(),
	})
	.superRefine((state, context) => {
		if (
			state.gameId !== state.desiredPresentation.id ||
			state.appliedRevision > state.desiredRevision ||
			(state.channelId === null) !== (state.messageId === null) ||
			(state.appliedRevision > 0 && state.messageId === null)
		) {
			context.addIssue({
				code: 'custom',
				message:
					'Inconsistent presentation identity, revisions or receipt references',
			})
		}
	})

export type ChannelBetting = z.infer<typeof channelBettingSchema>
export type ChannelAggregatedV2 = z.infer<typeof channelAggregatedV2Schema>
export type ChannelCreationEventV2 = z.infer<
	typeof channelCreationEventV2Schema
>
export type ChannelPresentationUpdateV1 = z.infer<
	typeof channelPresentationUpdateV1Schema
>
export type ChannelPresentationReceipt = z.infer<
	typeof channelPresentationReceiptSchema
>
export type ChannelPresentationState = z.infer<
	typeof channelPresentationStateSchema
>
