import { z } from 'zod'
import { logger } from '../../../logging/WinstonLogger.js'
import {
	dailyPropsPayloadSchema,
	notificationBetResultsSchema,
} from '../shared-payload-schemas.js'
import {
	BET_REFUND_REASONS,
	type NotifyBetUsers,
} from './notifications.interface.js'

// The published 3.20.0 contract strips refund_reason, so read it on its own.
const refundReasonSchema = z.object({
	refund_reason: z.enum(BET_REFUND_REASONS).optional().catch(undefined),
})

export function validateNotifyBetUsers(
	payload: unknown,
): NotifyBetUsers | null {
	const result = notificationBetResultsSchema.safeParse(payload)

	if (!result.success) {
		logger.error({
			method: 'validateNotifyBetUsers',
			event: 'push_payload_rejected',
			schema: 'notificationBetResults',
			errors: result.error.issues,
		})
		return null
	}

	const refundReason =
		refundReasonSchema.safeParse(payload).data?.refund_reason
	const reason = refundReason ? { refundReason } : {}

	return {
		winners: (result.data.winners ?? []).map((winner) => {
			const withGuild = winner as typeof winner & {
				guildId?: string
				guild_id?: string
			}
			return {
				...winner,
				guildId: withGuild.guildId ?? withGuild.guild_id,
				result: { ...winner.result, outcome: 'won' as const },
			}
		}),
		losers: (result.data.losers ?? []).map((loser) => {
			const withGuild = loser as typeof loser & {
				guildId?: string
				guild_id?: string
			}
			return {
				...loser,
				guildId: withGuild.guildId ?? withGuild.guild_id,
				result: { ...loser.result, outcome: 'lost' as const },
			}
		}),
		pushes: (result.data.pushes ?? []).map((push) => {
			if ('userid' in push) {
				return {
					userId: push.userid,
					betId: push.betid,
					result: {
						outcome: 'push' as const,
						team: push.team,
						betAmount: push.amount,
						...reason,
					},
				}
			}

			return {
				...push,
				result: { ...push.result, outcome: 'push' as const, ...reason },
			}
		}),
	}
}

export function validateDailyPropsPayload(payload: unknown) {
	const result = dailyPropsPayloadSchema.safeParse(payload)

	if (!result.success) {
		logger.error({
			method: 'validateDailyPropsPayload',
			event: 'push_payload_rejected',
			schema: 'dailyPropsPayload',
			errors: result.error.issues,
		})
		return null
	}

	return result.data
}
