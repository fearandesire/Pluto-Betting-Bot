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
		winners: (result.data.winners ?? []).map((winner) => ({
			...winner,
			result: { ...winner.result, outcome: 'won' as const },
		})),
		losers: (result.data.losers ?? []).map((loser) => ({
			...loser,
			result: { ...loser.result, outcome: 'lost' as const },
		})),
		pushes: (result.data.pushes ?? []).map((push) => ({
			...push,
			result: { ...push.result, outcome: 'push' as const },
		})),
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
