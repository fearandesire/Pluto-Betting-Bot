import { logger } from '../../../logging/WinstonLogger.js'
import {
	type PropSettledNotification,
	propSettledNotificationSchema,
} from '../shared-payload-schemas.js'

/** Parse and strictly validate a Khronos prop settlement callback. */
export function validatePropSettledNotification(
	payload: unknown,
): PropSettledNotification | null {
	const result = propSettledNotificationSchema.safeParse(payload)

	if (!result.success) {
		logger.warn({
			method: 'validatePropSettledNotification',
			event: 'prop.notification.validation_failed',
			message: 'Invalid prop settlement notification payload',
			errors: result.error.issues,
		})
		return null
	}

	const { correct, incorrect, total } = result.data.tallies
	if (correct + incorrect !== total) {
		logger.warn({
			method: 'validatePropSettledNotification',
			event: 'prop.notification.tally_invariant_failed',
			message: 'Prop settlement tallies must sum to total',
			correct,
			incorrect,
			total,
		})
		return null
	}

	return result.data
}
