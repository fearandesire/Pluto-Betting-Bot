import type { MatchDetailDto } from '@kh-openapi'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CacheManager } from '../../../../cache/cache-manager.js'

vi.mock('../../../../logging/WinstonLogger.js', () => ({
	logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))

vi.mock('../../../Khronos/matches/matchApiWrapper.js', () => ({
	default: vi.fn(),
}))

import MatchCacheService from '../match-cache-service.js'

function makeMatch(overrides: Partial<MatchDetailDto> = {}): MatchDetailDto {
	return {
		id: 'match-1',
		home_team: 'Lakers',
		away_team: 'Celtics',
		commence_time: '2025-02-05T00:00:00Z',
		sport: 'basketball_nba',
		...overrides,
	}
}

function makeCache(stored: unknown = null): Pick<CacheManager, 'get' | 'set'> {
	return {
		get: vi.fn().mockResolvedValue(stored),
		set: vi.fn().mockResolvedValue(undefined),
	}
}

describe('MatchCacheService', () => {
	describe('getMatches', () => {
		it('returns null when cache is empty', async () => {
			const svc = new MatchCacheService(makeCache(null) as CacheManager)
			expect(await svc.getMatches()).toBeNull()
		})

		it('returns null when cached value is an empty array', async () => {
			const svc = new MatchCacheService(makeCache([]) as CacheManager)
			expect(await svc.getMatches()).toBeNull()
		})

		it('returns null when cached value is not an array', async () => {
			const svc = new MatchCacheService(
				makeCache('bad-value') as CacheManager,
			)
			expect(await svc.getMatches()).toBeNull()
		})

		it('returns the cached array when it has entries', async () => {
			const matches = [makeMatch()]
			const svc = new MatchCacheService(
				makeCache(matches) as CacheManager,
			)
			expect(await svc.getMatches()).toEqual(matches)
		})
	})

	describe('getMatch', () => {
		const matches = [
			makeMatch({ id: 'match-1' }),
			makeMatch({ id: 'match-2', home_team: 'Bulls', away_team: 'Heat' }),
		]

		it('returns the correct match by id', async () => {
			const svc = new MatchCacheService(
				makeCache(matches) as CacheManager,
			)
			const result = await svc.getMatch('match-2')
			expect(result?.home_team).toBe('Bulls')
		})

		it('returns null for an unknown id', async () => {
			const svc = new MatchCacheService(
				makeCache(matches) as CacheManager,
			)
			expect(await svc.getMatch('does-not-exist')).toBeNull()
		})

		it('returns null when matchid is an empty string', async () => {
			const svc = new MatchCacheService(
				makeCache(matches) as CacheManager,
			)
			expect(await svc.getMatch('')).toBeNull()
		})

		it('returns null when cache is empty', async () => {
			const svc = new MatchCacheService(makeCache(null) as CacheManager)
			expect(await svc.getMatch('match-1')).toBeNull()
		})
	})

	describe('cacheMatches', () => {
		it('calls cache.set with the matches and a 24-hour TTL', async () => {
			const cache = makeCache() as CacheManager
			const svc = new MatchCacheService(cache)
			const matches = [makeMatch()]
			await svc.cacheMatches(matches)
			expect(cache.set).toHaveBeenCalledWith('matches', matches, 86400)
		})
	})
})
