import type {
	DoubleDownDto,
	GetBalanceDto,
	GetProfileDto,
	InitBetslipRespDTO,
	PlacedBetslipDto,
} from '@kh-openapi'
import { z } from 'zod'
import { logger } from '../../logging/WinstonLogger.js'

type ApiResponse =
	| GetProfileDto
	| GetBalanceDto
	| InitBetslipRespDTO
	| PlacedBetslipDto
	| DoubleDownDto

const BetslipSchema = z.object({
	isNewUser: z.boolean(),
	userid: z.string(),
})

const TopLevelResponseSchema = z.object({
	isNewUser: z.boolean(),
	userid: z.string(),
})

const NestedBetslipResponseSchema = z.object({
	betslip: BetslipSchema,
})

/**
 * Utility for detecting new users from Khronos API responses.
 * Handles both top-level and nested `isNewUser` flags.
 */
export class NewUserDetectionService {
	/**
	 * Detects if a user is new from various API response structures.
	 * @param response - API response that may contain isNewUser flag
	 * @returns Object with userId if user is new, validation errors if schemas failed, or null if not new
	 */
	static detectNewUser(
		response: ApiResponse,
	):
		| { userId: string }
		| { validationErrors: { direct: z.ZodError; betslipData: z.ZodError } }
		| null {
		logger.debug({
			message: 'Attempting new user detection',
			metadata: {
				source: this.detectNewUser.name,
				hasIsNewUser: 'isNewUser' in response,
				hasUserid: 'userid' in response,
				hasBetslip: 'betslip' in response,
				responseKeys: Object.keys(response),
			},
		})

		const directResult = TopLevelResponseSchema.safeParse(response)
		if (directResult.success && directResult.data.isNewUser) {
			logger.debug({
				message: 'New user detected via top-level schema',
				metadata: {
					source: this.detectNewUser.name,
					userId: directResult.data.userid,
				},
			})
			return { userId: directResult.data.userid }
		}

		const betslipResult = NestedBetslipResponseSchema.safeParse(response)
		if (betslipResult.success && betslipResult.data.betslip.isNewUser) {
			logger.debug({
				message: 'New user detected via nested betslip schema',
				metadata: {
					source: this.detectNewUser.name,
					userId: betslipResult.data.betslip.userid,
				},
			})
			return { userId: betslipResult.data.betslip.userid }
		}

		if (!directResult.success && !betslipResult.success) {
			logger.debug({
				message: 'Schema validation failed - logging details',
				metadata: {
					source: this.detectNewUser.name,
					directErrors: directResult.error.issues.map((i) => ({
						path: i.path.join('.'),
						message: i.message,
					})),
					betslipErrors: betslipResult.error.issues.map((i) => ({
						path: i.path.join('.'),
						message: i.message,
					})),
				},
			})
			return {
				validationErrors: {
					direct: directResult.error,
					betslipData: betslipResult.error,
				},
			}
		}

		logger.debug({
			message: 'User is not new or isNewUser=false',
			metadata: { source: this.detectNewUser.name },
		})
		return null
	}
}
