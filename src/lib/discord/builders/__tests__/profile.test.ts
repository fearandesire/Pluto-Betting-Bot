import { describe, expect, it } from 'vitest'
import { decodeProfileShare, encodeProfileShare } from '../profile.js'

describe('profile share custom id', () => {
	const route = {
		ownerId: '111111111111111111',
		targetId: '22222222222222222',
	}

	it('round-trips and stays within the 100 char limit', () => {
		const id = encodeProfileShare(route)
		expect(id).toBe('profile.v1.share.111111111111111111.22222222222222222')
		expect(id.length).toBeLessThanOrEqual(100)
		expect(decodeProfileShare(id)).toEqual(route)
	})

	it('rejects non-snowflake ids on both sides', () => {
		expect(() =>
			encodeProfileShare({ ownerId: 'abc', targetId: route.targetId }),
		).toThrow()
		expect(decodeProfileShare('profile.v1.share.abc.123')).toBeNull()
	})
})
