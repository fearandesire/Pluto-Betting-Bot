import type { MatchDetailDto } from '@kh-openapi'
import { teamResolver } from 'resolve-team'
import type { CacheManager } from '../../../cache/cache-manager.js'
import { logger } from '../../../logging/WinstonLogger.js'
import MatchApiWrapper from '../../Khronos/matches/matchApiWrapper.js'

const REFRESH_TTL_MS = 30 * 1000
const MISSING_ID_TTL_MS = 30 * 1000

export default class MatchCacheService {
	private static instance: MatchCacheService
	private lastRefreshAt = 0
	private missingIds = new Map<string, number>()
	private refreshInFlight = false

	private constructor(private cache: CacheManager) {}

	/**
	 * Get the singleton instance of MatchCacheService.
	 * The cache instance will be updated if a different CacheManager is provided,
	 * but the refresh state (lastRefreshAt, missingIds, refreshInFlight) is preserved
	 * across all getInstance() calls.
	 * @param cache The CacheManager instance to use for caching operations
	 */
	public static getInstance(cache: CacheManager): MatchCacheService {
		if (!MatchCacheService.instance) {
			MatchCacheService.instance = new MatchCacheService(cache)
		} else {
			// Update cache instance if a different one is provided
			MatchCacheService.instance.cache = cache
		}
		return MatchCacheService.instance
	}

	async requestMatches() {
		const data = await new MatchApiWrapper().getAllMatches()
		return data
	}

	async cacheMatches(matches: MatchDetailDto[]) {
		await this.cache.set('matches', matches, 86400)
		logger.info({
			message: 'Match Cache updated successfully',
			metadata: {
				source: 'MatchCacheService.cacheMatches',
				matchCount: matches.length,
			},
		})
	}

	async getMatches(): Promise<MatchDetailDto[] | null> {
		const cachedMatches = await this.cache.get('matches')
		if (!cachedMatches || !Array.isArray(cachedMatches)) {
			return null
		}
		return cachedMatches
	}

	async getMatch(matchid: string): Promise<MatchDetailDto | null> {
		if (!matchid) {
			return null
		}
		const now = Date.now()
		const toDelete: string[] = []
		for (const [id, expiry] of this.missingIds) {
			if (expiry <= now) toDelete.push(id)
		}
		for (const id of toDelete) this.missingIds.delete(id)
		if (this.missingIds.has(matchid)) {
			return null
		}
		const cachedMatches = await this.getMatches()
		const cachedMatch = cachedMatches?.find(
			(match: MatchDetailDto) => match.id === matchid,
		)
		if (cachedMatch) {
			return cachedMatch
		}

		const shouldRefresh =
			now - this.lastRefreshAt >= REFRESH_TTL_MS && !this.refreshInFlight
		if (!shouldRefresh) {
			return null
		}
		const { matches: freshMatches, fromRefresh } =
			await this.refreshMatches()
		const match =
			freshMatches?.find((m: MatchDetailDto) => m.id === matchid) ?? null
		if (fromRefresh && !match) {
			this.missingIds.set(matchid, now + MISSING_ID_TTL_MS)
		}
		return match
	}

	private async refreshMatches(): Promise<{
		matches: MatchDetailDto[] | null
		fromRefresh: boolean
	}> {
		if (this.refreshInFlight) {
			const cached = await this.getMatches()
			return { matches: cached, fromRefresh: false }
		}
		if (Date.now() - this.lastRefreshAt < REFRESH_TTL_MS) {
			const cached = await this.getMatches()
			return { matches: cached, fromRefresh: false }
		}

		this.refreshInFlight = true
		const maxAttempts = 3 // Total attempts: 1 initial + 2 retries
		const baseDelayMs = 500

		try {
			for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
				try {
					const response = await this.requestMatches()
					const matches = response?.matches
					if (!Array.isArray(matches) || matches.length === 0) {
						return { matches: null, fromRefresh: true }
					}
					await this.cacheMatches(matches)
					this.lastRefreshAt = Date.now()
					return { matches, fromRefresh: true }
				} catch (error) {
					const isTransient = this.isTransientError(error)
					const isFinalAttempt = attempt >= maxAttempts - 1

					if (!isTransient) {
						logger.error({
							message: 'Failed to refresh matches cache',
							metadata: {
								source: 'MatchCacheService.refreshMatches',
								error:
									error instanceof Error
										? error.stack
										: error,
							},
						})
						return { matches: null, fromRefresh: true }
					}

					if (isFinalAttempt) {
						logger.error({
							message:
								'Failed to refresh matches cache after retries',
							metadata: {
								source: 'MatchCacheService.refreshMatches',
								attempts: maxAttempts,
								error:
									error instanceof Error
										? error.stack
										: error,
							},
						})
						return { matches: null, fromRefresh: true }
					}

					const backoffMs = baseDelayMs * 2 ** attempt
					const jitterMs = Math.floor(Math.random() * baseDelayMs)
					const delayMs = backoffMs + jitterMs

					logger.warn({
						message: 'Retrying match cache refresh',
						metadata: {
							source: 'MatchCacheService.refreshMatches',
							attempt: attempt + 1,
							maxAttempts,
							delayMs,
						},
					})

					await new Promise((resolve) => setTimeout(resolve, delayMs))
				}
			}
			return { matches: null, fromRefresh: true }
		} finally {
			this.refreshInFlight = false
		}
	}

	private isTransientError(error: unknown): boolean {
		const err = error as {
			response?: { status?: number }
			code?: string
			request?: unknown
			isAxiosError?: boolean
		}
		const status = err?.response?.status
		if (typeof status === 'number') {
			return status === 429 || status >= 500
		}
		if (err?.request || err?.code || err?.isAxiosError) {
			return true
		}
		return false
	}

	async matchesByTeam(team: string) {
		const resolvedTeamName = await teamResolver.resolve(team, {
			full: false,
		})
		if (!resolvedTeamName) {
			throw new Error('Unable to identify the sports team you specified')
		}
		// Search match cache and identify matches that contain the team
		const matchCache = await this.getMatches()
		if (!matchCache) {
			throw new Error('Unable to retrieve stored matches at this time.')
		}
		const matches = matchCache.filter((match: MatchDetailDto) => {
			return (
				match.home_team === resolvedTeamName ||
				match.away_team === resolvedTeamName
			)
		})
		return matches
	}
}
