import { reportBettingFailure } from '../../../services/alerts/betting-ops-alert.js'

/**
 * Betslip placement and its lookups, plus parlay placement. The route is
 * reduced to its first two segments (`betslips/place`), so no id reaches an alert.
 */
const BETTING_ROUTE = /\/(betslips|parlays)\/([a-z]+)(?=[/?#]|$)/

export type BettingOutageCause = 'timeout' | 'network' | 'server'

export interface BettingOutageOutcome {
	url: string
	requestId?: string
	/** HTTP status when Khronos answered. */
	status?: number
	/** The thrown error when no response arrived. */
	error?: unknown
}

const TIMEOUT_NAMES = new Set(['TimeoutError', 'AbortError'])
const TIMEOUT_CODES = new Set(['ECONNABORTED', 'ETIMEDOUT'])

const isTimeout = (error: unknown): boolean => {
	if (typeof error !== 'object' || error === null) return false
	const { name, code } = error as { name?: unknown; code?: unknown }
	return (
		(typeof name === 'string' && TIMEOUT_NAMES.has(name)) ||
		(typeof code === 'string' && TIMEOUT_CODES.has(code))
	)
}

/**
 * Only infrastructure failures are outages. Any status below 500 is an answer
 * from Khronos (validation, insufficient funds, not found) that the user sees
 * directly, so it does not page ops.
 */
export function classifyBettingOutage(
	outcome: Pick<BettingOutageOutcome, 'status' | 'error'>,
): BettingOutageCause | null {
	if (outcome.status !== undefined) {
		return outcome.status >= 500 ? 'server' : null
	}
	if (outcome.error === undefined) return null
	return isTimeout(outcome.error) ? 'timeout' : 'network'
}

/** The betting route an URL points at, or null when the URL is not a betting route. */
export function bettingRouteOf(url: string): string | null {
	const pathname = new URL(url, 'http://khronos.invalid').pathname
	const match = pathname.match(BETTING_ROUTE)
	return match ? `${match[1]}/${match[2]}` : null
}

/** Pages ops once per route and cause, through the deduplicated betting alerter. */
export function checkBettingOutage(outcome: BettingOutageOutcome): void {
	const cause = classifyBettingOutage(outcome)
	if (!cause) return
	const route = bettingRouteOf(outcome.url)
	if (!route) return
	const detail = outcome.status !== undefined ? ` ${outcome.status}` : ''
	reportBettingFailure({
		key: `khronos.betting_unavailable:${route}:${cause}`,
		event: 'khronos.betting_unavailable',
		requestId: outcome.requestId ?? null,
		error: new Error(`Khronos ${cause}${detail} on ${route}`),
	})
}
