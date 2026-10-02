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
	// Khronos counts every settled prediction row in `total` but only grades
	// `is_correct` true/false. A push or void settles predictions without
	// grading them, so those results legitimately send correct + incorrect < total
	// (typically 0 + 0 = N). Only won/lost must account for every prediction.
	const ungradedResult =
		result.data.result === 'push' || result.data.result === 'void'
	const consistent = ungradedResult
		? correct + incorrect <= total
		: correct + incorrect === total
	if (!consistent) {
		logger.warn({
			method: 'validatePropSettledNotification',
			event: 'prop.notification.tally_invariant_failed',
			message: ungradedResult
				? 'Prop settlement graded tallies cannot exceed total'
				: 'Prop settlement tallies must sum to total',
			result: result.data.result,
			correct,
			incorrect,
			total,
		})
		return null
	}

	return result.data
}
