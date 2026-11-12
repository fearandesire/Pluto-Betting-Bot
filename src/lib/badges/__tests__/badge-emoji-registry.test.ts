import { afterEach, describe, expect, it, vi } from 'vitest'
import {
	BadgeEmojiService,
	buildBadgeEmojiRegistry,
	getBadgeEmojiRegistry,
	resetBadgeEmojiRegistry,
	startBadgeEmojiRegistry,
} from '../badge-emoji-registry.js'

const ID = '123456789012345678'

afterEach(() => {
	resetBadgeEmojiRegistry()
	vi.useRealTimers()
})

describe('buildBadgeEmojiRegistry', () => {
	it('formats an emoji only for a known name with a snowflake id', () => {
		const registry = buildBadgeEmojiRegistry([
			{ name: 'p_opening_score', id: ID },
			{ name: 'p_club_fifty', id: 'not-a-snowflake' },
			{ name: 'unrelated_emoji', id: ID },
			{ name: null, id: ID },
		])
		expect(registry.format('p_opening_score')).toBe(
			`<:p_opening_score:${ID}>`,
		)
		expect(registry.format('p_club_fifty')).toBeNull()
		expect(registry.format('unrelated_emoji')).toBeNull()
		expect(registry.size).toBe(1)
	})

	it('returns names only when the application has no badge emoji', () => {
		const registry = buildBadgeEmojiRegistry([])
		expect(registry.format('p_opening_score')).toBeNull()
		expect(getBadgeEmojiRegistry().format('p_opening_score')).toBeNull()
	})
})

describe('BadgeEmojiService', () => {
	it('keeps the previous map when a refresh fails', async () => {
		const fetchEmojis = vi
			.fn()
			.mockResolvedValueOnce([{ name: 'p_courtside', id: ID }])
			.mockRejectedValueOnce(new Error('discord down'))
		const onError = vi.fn()
		const svc = new BadgeEmojiService(fetchEmojis, onError)
		await svc.refresh()
		await svc.refresh()
		expect(onError).toHaveBeenCalledOnce()
		expect(svc.current.format('p_courtside')).toBe(`<:p_courtside:${ID}>`)
	})

	it('leaves an empty map when the first fetch fails', async () => {
		const svc = new BadgeEmojiService(
			async () => {
				throw new Error('discord down')
			},
			() => undefined,
		)
		await svc.refresh()
		expect(svc.current.format('p_courtside')).toBeNull()
	})

	it('refreshes every six hours', async () => {
		vi.useFakeTimers()
		const fetchEmojis = vi.fn().mockResolvedValue([])
		const svc = new BadgeEmojiService(fetchEmojis)
		await svc.start()
		expect(fetchEmojis).toHaveBeenCalledTimes(1)
		await vi.advanceTimersByTimeAsync(6 * 60 * 60 * 1000)
		expect(fetchEmojis).toHaveBeenCalledTimes(2)
		svc.stop()
	})
})

describe('startBadgeEmojiRegistry', () => {
	it('does not fetch when profiles are disabled', async () => {
		const fetchEmojis = vi.fn()
		await startBadgeEmojiRegistry({ enabled: false, fetchEmojis })
		expect(fetchEmojis).not.toHaveBeenCalled()
	})

	it('serves formatted emoji once started', async () => {
		await startBadgeEmojiRegistry({
			enabled: true,
			fetchEmojis: async () => [{ name: 'p_due_a_win', id: ID }],
		})
		expect(getBadgeEmojiRegistry().format('p_due_a_win')).toBe(
			`<:p_due_a_win:${ID}>`,
		)
	})
})
