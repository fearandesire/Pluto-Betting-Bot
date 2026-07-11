/**
 * American odds helpers used while the parlay builder is running locally.
 *
 * Khronos remains the source of truth at init/place time. Keeping the
 * conversion here only lets the card show a useful running estimate before
 * the server snapshots the leg prices.
 */
export function americanToDecimal(american: number): number {
	if (!Number.isFinite(american) || american === 0) {
		throw new Error('American odds must be a non-zero finite number')
	}

	return american > 0 ? 1 + american / 100 : 1 + 100 / Math.abs(american)
}

export function decimalToAmerican(decimal: number): number {
	if (!Number.isFinite(decimal) || decimal <= 1) {
		throw new Error('Decimal odds must be greater than 1')
	}

	return decimal >= 2
		? Math.round((decimal - 1) * 100)
		: Math.round(-100 / (decimal - 1))
}

export function combineAmericanOdds(legs: number[]): {
	american: number
	decimal: number
} {
	if (legs.length === 0) {
		throw new Error('At least one odds leg is required')
	}

	const decimal = legs.reduce(
		(combined, leg) => combined * americanToDecimal(leg),
		1,
	)

	return {
		american: decimalToAmerican(decimal),
		decimal,
	}
}
