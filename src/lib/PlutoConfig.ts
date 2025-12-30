import { logger } from '../utils/logging/WinstonLogger.js'
import { type BetContext, FooterManager } from './footers/FooterManager.js'
import {
	FALLBACK_FOOTERS,
	type FooterTypes,
} from './footers/fallbackFooters.js'

export { type FooterTypes, type BetContext }

/** Valid footer type keys for runtime validation */
const VALID_FOOTER_TYPES = new Set<FooterTypes>([
	...(Object.keys(FALLBACK_FOOTERS) as (keyof typeof FALLBACK_FOOTERS)[]),
	'all',
])

/** Default footer returned when FooterManager fails */
const DEFAULT_FOOTER = ''

/**
 * Get a random footer message based on the specified type
 * Uses dynamic configuration from Khronos with local fallback
 * @param type - The type of footer message to return
 * @returns A random footer message string
 */
function randomFooter(type: FooterTypes = 'core'): string {
	const validType: FooterTypes = VALID_FOOTER_TYPES.has(type) ? type : 'core'

	try {
		const footer = FooterManager.getInstance().getFooter(validType)
		return footer ?? DEFAULT_FOOTER
	} catch (error) {
		logger.error({
			message: 'Failed to get footer from FooterManager',
			metadata: {
				source: 'PlutoConfig.randomFooter',
				requestedType: type,
				resolvedType: validType,
				error: error instanceof Error ? error.stack : error,
			},
		})
		return DEFAULT_FOOTER
	}
}

const supportMessage = 'Please reach out to `fenixforever` for support.'

/**
 * Get a context-aware footer for betting scenarios
 * @param context - Bet context including balance, bet amount, and optional odds
 * @returns Footer string based on bet context
 */
function betFooter(context: BetContext): string {
	try {
		const footer = FooterManager.getInstance().getFooterForBet(context)
		return footer ?? DEFAULT_FOOTER
	} catch (error) {
		logger.error({
			message: 'Failed to get context-aware footer from FooterManager',
			metadata: {
				source: 'PlutoConfig.betFooter',
				context,
				error: error instanceof Error ? error.stack : error,
			},
		})
		return DEFAULT_FOOTER
	}
}

export { randomFooter as helpfooter, betFooter, supportMessage }
