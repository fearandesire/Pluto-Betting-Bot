import { logger } from '../../../logging/WinstonLogger.js'
import {
	dailyPropsPayloadSchema,
	notificationBetResultsSchema,
} from '../shared-payload-schemas.js'
import type { NotifyBetUsers } from './notifications.interface.js'

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
					},
				}
			}

			return {
				...push,
				result: { ...push.result, outcome: 'push' as const },
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
