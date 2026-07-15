import { logger } from '../../../logging/WinstonLogger.js'
import {
	type ParlayResultNotification,
	parlayResultNotificationSchema,
} from './parlay-notification-contract.js'

/** Parse and strictly validate the Khronos parlay result notification. */
export function validateParlayResultNotification(
	payload: unknown,
): ParlayResultNotification | null {
	const result = parlayResultNotificationSchema.safeParse(payload)

	if (!result.success) {
		logger.warn({
			method: 'validateParlayResultNotification',
			event: 'parlay.notification.validation_failed',
			message: 'Invalid parlay result notification payload',
			errors: result.error.issues,
		})
		return null
	}

	return result.data
}
