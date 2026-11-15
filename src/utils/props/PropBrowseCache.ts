import { logger } from '../logging/WinstonLogger.js'

/** The Browse more list lives as long as a settlement can name its board. */
export const PROP_BROWSE_TTL_SECONDS = 7 * 24 * 60 * 60

export interface PropBrowseState {
	title: string
	lines: string[]
}

export function propBrowseKey(token: string): string {
	return `props:browse:${token}`
}

/**
 * Caches the whole post's list for a board's Browse more button. A Redis miss
 * costs only that button, so the caller posts without it instead of failing
 * the board.
 */
export async function savePropBrowse(
	token: string,
	state: PropBrowseState,
): Promise<boolean> {
	try {
		const { default: redisCache } = await import(
			'../cache/redis-instance.js'
		)
		await redisCache.setex(
			propBrowseKey(token),
			PROP_BROWSE_TTL_SECONDS,
			JSON.stringify(state),
		)
		return true
	} catch (error) {
		logger.warn({
			method: 'savePropBrowse',
			event: 'props.browse.cache_write_failed',
			token,
			error: error instanceof Error ? error.message : String(error),
		})
		return false
	}
}

/** Reads a cached list, returning null on a miss or malformed entry. */
export async function loadPropBrowse(
	token: string,
): Promise<PropBrowseState | null> {
	try {
		const { default: redisCache } = await import(
			'../cache/redis-instance.js'
		)
		const raw = await redisCache.get(propBrowseKey(token))
		if (!raw) return null
		const parsed = JSON.parse(raw) as Partial<PropBrowseState>
		if (
			typeof parsed.title !== 'string' ||
			!Array.isArray(parsed.lines) ||
			parsed.lines.some((line) => typeof line !== 'string')
		) {
			return null
		}
		return { title: parsed.title, lines: parsed.lines }
	} catch (error) {
		logger.warn({
			method: 'loadPropBrowse',
			event: 'props.browse.cache_read_failed',
			token,
			error: error instanceof Error ? error.message : String(error),
		})
		return null
	}
}
