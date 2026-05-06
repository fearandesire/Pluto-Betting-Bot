import GuildWrapper from './guild-wrapper.js'

/**
 * In-process TTL cache for `guild.sport`.
 *
 * Why this exists: every autocomplete keystroke fires a guild lookup against
 * Khronos to resolve the guild's sport, and that round-trip dominates
 * autocomplete latency. A guild's sport changes rarely (admin action), so a
 * short in-process cache eliminates the per-keystroke network call without
 * meaningfully harming freshness.
 */

const TTL_MS = 5 * 60 * 1000 // 5 minutes

interface CacheEntry {
	sport: string
	expiresAt: number
}

const cache = new Map<string, CacheEntry>()

/**
 * Inflight lookups deduped per guildId, so a burst of keystrokes during the
 * very first autocomplete on a cold cache makes a single Khronos call.
 */
const inflight = new Map<string, Promise<string>>()

/**
 * Returns the guild's sport, hitting Khronos at most once per `TTL_MS` window
 * per guildId across all callers in this process.
 */
export async function getGuildSport(guildId: string): Promise<string> {
	const now = Date.now()
	const hit = cache.get(guildId)
	if (hit && hit.expiresAt > now) {
		return hit.sport
	}

	const inflightHit = inflight.get(guildId)
	if (inflightHit) return inflightHit

	const lookup = (async () => {
		try {
			const guild = await new GuildWrapper().getGuild(guildId)
			cache.set(guildId, {
				sport: guild.sport,
				expiresAt: Date.now() + TTL_MS,
			})
			return guild.sport
		} finally {
			inflight.delete(guildId)
		}
	})()

	inflight.set(guildId, lookup)
	return lookup
}

/**
 * Manually evict a guild from the cache. Call this when you know the guild's
 * sport just changed (e.g. admin command), so the next autocomplete reflects
 * the new value immediately rather than waiting up to TTL_MS.
 */
export function invalidateGuildSport(guildId: string): void {
	cache.delete(guildId)
}

/**
 * Test-only: drop the entire cache.
 */
export function _resetGuildSportCacheForTests(): void {
	cache.clear()
	inflight.clear()
}
