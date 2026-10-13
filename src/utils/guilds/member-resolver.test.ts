import { describe, expect, it, vi } from 'vitest'
import { resolveLeaderboardMembers } from './member-resolver.js'

describe('leaderboard member REST resolution', () => {
	it('deduplicates IDs, uses cache and survives missing members', async () => {
		const cached = { displayName: 'Cached' }
		const fetched = { displayName: 'Fresh' }
		const fetch = vi.fn(async (id: string) => {
			if (id === 'gone') throw new Error('Unknown member')
			return fetched
		})
		const guild = {
			members: { cache: new Map([['cached', cached]]), fetch },
		}
		const members = await resolveLeaderboardMembers(guild as never, [
			'cached',
			'fresh',
			'fresh',
			'gone',
		])
		expect(members.get('cached')).toBe(cached)
		expect(members.get('fresh')).toBe(fetched)
		expect(members.has('gone')).toBe(false)
		expect(fetch.mock.calls.map(([id]) => id)).toEqual(['fresh', 'gone'])
	})
	it('caps uncached work and concurrent requests, preserving cached tail entries', async () => {
		let active = 0
		let maxActive = 0
		const fetch = vi.fn(async () => {
			active++
			maxActive = Math.max(maxActive, active)
			await new Promise((resolve) => setTimeout(resolve, 1))
			active--
			return { displayName: 'Member' }
		})
		const guild = {
			members: {
				cache: new Map([['tail', { displayName: 'Tail' }]]),
				fetch,
			},
		}
		const ids = Array.from({ length: 80 }, (_, i) => String(i))
		const members = await resolveLeaderboardMembers(guild as never, [
			...ids,
			'tail',
		])
		expect(fetch).toHaveBeenCalledTimes(50)
		expect(maxActive).toBeLessThanOrEqual(4)
		expect(members.has('79')).toBe(false)
		expect(members.has('tail')).toBe(true)
	})
})
