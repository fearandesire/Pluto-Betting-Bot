import {
	type OddsChangedDetailsDto,
	OddsChangedDetailsDtoCodeEnum,
	ResponseError,
} from '@pluto-khronos/api-client'

/**
 * Reads a Khronos 409 ODDS_CHANGED refusal. Returns null for any other error.
 * Reads a clone so ApiErrorHandler can still parse the original body.
 */
export async function parseOddsChanged(
	error: unknown,
): Promise<OddsChangedDetailsDto | null> {
	if (!(error instanceof ResponseError) || error.response.status !== 409) {
		return null
	}
	try {
		const body = await error.response.clone().json()
		const details = body?.details
		return details?.code === OddsChangedDetailsDtoCodeEnum.OddsChanged &&
			typeof details.current_odds === 'number'
			? (details as OddsChangedDetailsDto)
			: null
	} catch {
		return null
	}
}

export function formatAmericanOdds(odds: number): string {
	return odds > 0 ? `+${odds}` : `${odds}`
}

/** The bet changed after its double-down re-prompt was shown. */
export class StaleDoubleDownError extends Error {
	constructor() {
		super('The bet changed since the double-down prompt was shown')
		this.name = 'StaleDoubleDownError'
	}
}
