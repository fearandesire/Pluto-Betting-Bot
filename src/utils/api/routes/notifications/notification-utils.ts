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
		result.data.pushes?.map((push) => {
			if ('userid' in push) {
				const legacyPush = push as unknown as {
					userid: string
					betid: number
					team: string
					amount: number
				}
				return {
					userId: legacyPush.userid,
					betId: legacyPush.betid,
					result: {
						outcome: 'push' as const,
						team: legacyPush.team,
						betAmount: legacyPush.amount,
					},
				}
			}

			return {
				userId: push.userId,
				betId: push.betId,
				result: {
					outcome: 'push' as const,
					team: push.result.team,
					betAmount: push.result.betAmount,
				},
			}
		})

	return {
		winners: result.data.winners || [],
		losers: result.data.losers || [],
		pushes: transformedPushes || [],
	}
}
