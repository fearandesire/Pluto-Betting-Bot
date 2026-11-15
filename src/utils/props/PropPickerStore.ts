import { logger } from '../logging/WinstonLogger.js'
import type {
	PropPickerFilters,
	PropPickerPair,
	PropPickerPrice,
} from './PropPicker.js'

/** A pick survives a page turn and a slow price check, not a whole game day. */
export const PROP_PICKER_TTL_SECONDS = 30 * 60

export function propPickerKey(token: string): string {
	return `props:pick:${token}`
}

export type PropPickerSession = {
	token: string
	userId: string
	guildId: string
	sport: 'nba' | 'nfl'
	filters: PropPickerFilters
	page: number
	selected: string[]
	pairs: PropPickerPair[]
	prices: Record<string, PropPickerPrice>
}

export async function savePropPickerSession(
	token: string,
	session: PropPickerSession,
): Promise<boolean> {
	try {
		const { default: redisCache } = await import(
			'../cache/redis-instance.js'
		)
		await redisCache.setex(
			propPickerKey(token),
			PROP_PICKER_TTL_SECONDS,
			JSON.stringify(session),
		)
		return true
	} catch (error) {
		logger.warn({
			method: 'savePropPickerSession',
			event: 'props.pick.cache_write_failed',
			token,
			error: error instanceof Error ? error.message : String(error),
		})
		return false
	}
}

export async function loadPropPickerSession(
	token: string,
): Promise<PropPickerSession | null> {
	try {
		const { default: redisCache } = await import(
			'../cache/redis-instance.js'
		)
		const raw = await redisCache.get(propPickerKey(token))
		if (!raw) return null
		const parsed = JSON.parse(raw) as Partial<PropPickerSession>
		if (
			typeof parsed.token !== 'string' ||
			typeof parsed.userId !== 'string' ||
			typeof parsed.guildId !== 'string' ||
			(parsed.sport !== 'nba' && parsed.sport !== 'nfl') ||
			typeof parsed.page !== 'number' ||
			!Array.isArray(parsed.selected) ||
			parsed.selected.some((key) => typeof key !== 'string') ||
			!Array.isArray(parsed.pairs) ||
			parsed.pairs.some((pair) => typeof pair?.key !== 'string') ||
			typeof parsed.prices !== 'object' ||
			parsed.prices === null
		) {
			return null
		}
		return {
			token: parsed.token,
			userId: parsed.userId,
			guildId: parsed.guildId,
			sport: parsed.sport,
			filters: parsed.filters ?? {
				game: '',
				category: '',
				player: '',
			},
			page: parsed.page,
			selected: parsed.selected,
			pairs: parsed.pairs,
			prices: parsed.prices,
		}
	} catch (error) {
		logger.warn({
			method: 'loadPropPickerSession',
			event: 'props.pick.cache_read_failed',
			token,
			error: error instanceof Error ? error.message : String(error),
		})
		return null
	}
}

export async function clearPropPickerSession(token: string): Promise<void> {
	try {
		const { default: redisCache } = await import(
			'../cache/redis-instance.js'
		)
		await redisCache.del(propPickerKey(token))
	} catch (error) {
		logger.warn({
			method: 'clearPropPickerSession',
			event: 'props.pick.cache_delete_failed',
			token,
			error: error instanceof Error ? error.message : String(error),
		})
	}
}
