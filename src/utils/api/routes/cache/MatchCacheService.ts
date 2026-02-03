import type { MatchDetailDto } from '@kh-openapi'
import { teamResolver } from 'resolve-team'
import type { CacheManager } from '../../../cache/cache-manager.js'
import MatchApiWrapper from '../../Khronos/matches/matchApiWrapper.js'

const REFRESH_TTL_MS = 30 * 1000
const MISSING_ID_TTL_MS = 30 * 1000
const REFRESH_LOCK_KEY = 'match-cache-refresh-lock'
const REFRESH_LOCK_TTL_SECONDS = 30

export default class MatchCacheService {
	private lastRefreshAt = 0
	private missingIds = new Map<string, number>()

	constructor(private cache: CacheManager) {}

	async requestMatches() {
		const data = await new MatchApiWrapper().getAllMatches()
		return data
	}

	async cacheMatches(matches: MatchDetailDto[]) {
		await this.cache.set('matches', matches, 86400)
		console.log({
			method: this.cacheMatches.name,
			message: 'Match Cache updated successfully.',
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

		const isLocked = await this.isRefreshLocked()
		const shouldRefresh =
			now - this.lastRefreshAt >= REFRESH_TTL_MS && !isLocked
		if (!shouldRefresh) {
			return null
		}
		const { matches: freshMatches, fromRefresh } = await this.refreshMatches()
		const match =
			freshMatches?.find(
				(m: MatchDetailDto) => m.id === matchid,
			) ?? null
		if (fromRefresh && !match) {
			this.missingIds.set(matchid, now + MISSING_ID_TTL_MS)
		}
		return match
	}

	private async refreshMatches(): Promise<{
		matches: MatchDetailDto[] | null
		fromRefresh: boolean
	}> {
		if (Date.now() - this.lastRefreshAt < REFRESH_TTL_MS) {
			const cached = await this.getMatches()
			return { matches: cached, fromRefresh: false }
		}

		const lockAcquired = await this.acquireRefreshLock()
		if (!lockAcquired) {
			const cached = await this.getMatches()
			return { matches: cached, fromRefresh: false }
		}

		const maxRetries = 3
		const baseDelayMs = 500

		try {
			for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
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
					const isFinalAttempt = attempt >= maxRetries

					if (!isTransient) {
						console.error('Failed to refresh matches cache', error)
						return { matches: null, fromRefresh: true }
					}

					if (isFinalAttempt) {
						console.error('Failed to refresh matches cache after retries', error)
						return { matches: null, fromRefresh: true }
					}

					const backoffMs = baseDelayMs * 2 ** attempt
					const jitterMs = Math.floor(Math.random() * baseDelayMs)
					const delayMs = backoffMs + jitterMs

					console.warn('Retrying match cache refresh', {
						attempt: attempt + 1,
						maxRetries,
						delayMs,
					})

					await new Promise((resolve) => setTimeout(resolve, delayMs))
				}
			}
			return { matches: null, fromRefresh: true }
		} finally {
			await this.releaseRefreshLock()
		}
	}

	private async isRefreshLocked(): Promise<boolean> {
		// cache.get() returns false when key doesn't exist (see CacheManager.get)
		const lockValue = await this.cache.get(REFRESH_LOCK_KEY)
		return lockValue !== false
	}

	private async acquireRefreshLock(): Promise<boolean> {
		// Use Redis SETNX (SET if Not eXists) for atomic lock acquisition
		// Returns 'OK' if the key was set, null if the key already exists
		const result = await this.cache.cache.set(
			REFRESH_LOCK_KEY,
			Date.now().toString(),
			'EX',
			REFRESH_LOCK_TTL_SECONDS,
			'NX',
		)
		return result === 'OK'
	}

	private async releaseRefreshLock(): Promise<void> {
		// Note: We don't verify lock ownership before releasing because:
		// 1. All instances perform the same refresh operation (idempotent)
		// 2. The lock has a TTL for automatic cleanup on crashes
		// 3. Worst case: another instance releases early and triggers a duplicate refresh,
		//    which is acceptable given the REFRESH_TTL_MS check prevents excessive refreshes
		await this.cache.remove(REFRESH_LOCK_KEY)
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
