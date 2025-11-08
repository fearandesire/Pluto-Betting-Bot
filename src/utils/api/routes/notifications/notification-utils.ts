import { notificationBetResultsSchema } from '@pluto-khronos/types'
import type {
	BetNotificationPush,
	NotifyBetUsers,
} from './notifications.interface.js'

export function validateNotifyBetUsers(
	payload: unknown,
): NotifyBetUsers | null {
	const result = notificationBetResultsSchema.safeParse(payload)

	if (!result.success) {
		console.error({
			method: 'validateNotifyBetUsers',
			message: 'Invalid notification payload',
			errors: result.error.issues,
		})
		return null
	}

	// Transform Zod output to match our internal types
	// Transform pushes from IBetslipPush[] to BetNotificationPush[]
	const transformedPushes: BetNotificationPush[] | undefined =
		result.data.pushes?.map((push) => ({
			userId: push.userid,
			betId: push.betid,
			result: {
				outcome: 'push' as const,
				team: push.team,
				betAmount: push.amount,
			},
		}))

	return {
		winners: result.data.winners || [],
		losers: result.data.losers || [],
		pushes: transformedPushes || [],
	}
}
