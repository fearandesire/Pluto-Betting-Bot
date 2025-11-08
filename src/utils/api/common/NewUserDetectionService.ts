import type {
	DoubleDownDto,
	GetBalanceDto,
	GetProfileDto,
	InitBetslipRespDTO,
	PlacedBetslipDto,
} from '@kh-openapi'
import { z } from 'zod'

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
		const directResult = TopLevelResponseSchema.safeParse(response)
		if (directResult.success && directResult.data.isNewUser) {
			return { userId: directResult.data.userid }
		}

		const betslipResult = NestedBetslipResponseSchema.safeParse(response)
		if (betslipResult.success && betslipResult.data.betslip.isNewUser) {
			return { userId: betslipResult.data.betslip.userid }
		}

		if (!directResult.success && !betslipResult.success) {
			return {
				validationErrors: {
					direct: directResult.error,
					betslipData: betslipResult.error,
				},
			}
		}

		return null
	}
}
