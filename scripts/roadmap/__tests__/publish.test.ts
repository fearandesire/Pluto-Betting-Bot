import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
	filterPublishableItems,
	parseMilestoneAllowlist,
	renderRoadmap,
} from '../publish.js'

interface Fixture {
	items: Array<Record<string, unknown>>
}

const fixture = JSON.parse(
	readFileSync(resolve(import.meta.dirname, '../fixtures/export.sample.json'), 'utf8'),
) as Fixture

const allowedMilestone = '11111111-1111-4111-8111-111111111111'
const now = new Date('2026-09-13T00:00:00.000Z')

describe('public roadmap publisher', () => {
	it('requires the public label and an allowed milestone', () => {
		const published = filterPublishableItems(fixture.items, {
			milestoneAllowlist: new Set([allowedMilestone]),
			now,
		})

		expect(published.map((item) => item.publicId)).toEqual([
			'roadmap-now-001',
			'roadmap-next-001',
			'roadmap-later-001',
			'roadmap-shipped-001',
		])
	})

	it('withdraws an item when the public label is removed', () => {
		const items = fixture.items.map((item) =>
			item.publicId === 'roadmap-now-001'
				? { ...item, labels: ['internal'] }
				: item,
		)

		const published = filterPublishableItems(items, {
			milestoneAllowlist: new Set([allowedMilestone]),
			now,
		})

		expect(published.some((item) => item.publicId === 'roadmap-now-001')).toBe(false)
	})

	it('withdraws an item when its milestone is not allowlisted', () => {
		const items = fixture.items.map((item) =>
			item.publicId === 'roadmap-next-001'
				? { ...item, milestoneId: '22222222-2222-4222-8222-222222222222' }
				: item,
		)

		const published = filterPublishableItems(items, {
			milestoneAllowlist: new Set([allowedMilestone]),
			now,
		})

		expect(published.some((item) => item.publicId === 'roadmap-next-001')).toBe(false)
	})

	it('withdraws an item listed in the tombstones', () => {
		const published = filterPublishableItems(fixture.items, {
			milestoneAllowlist: new Set([allowedMilestone]),
			tombstones: new Set(['roadmap-later-001']),
			now,
		})

		expect(published.some((item) => item.publicId === 'roadmap-later-001')).toBe(false)
	})

	it('parses a comma-separated milestone allowlist', () => {
		expect(
			parseMilestoneAllowlist(
				` ${allowedMilestone}, 22222222-2222-4222-8222-222222222222 `,
			),
		).toEqual(
			new Set([
				allowedMilestone,
				'22222222-2222-4222-8222-222222222222',
			]),
		)
	})

	it('includes only shipped work from the last 90 days', () => {
		const published = filterPublishableItems(fixture.items, {
			milestoneAllowlist: new Set([allowedMilestone]),
			now,
		})

		expect(published.some((item) => item.publicId === 'roadmap-shipped-old')).toBe(false)
		expect(published.some((item) => item.publicId === 'roadmap-shipped-001')).toBe(true)
	})

	it('renders a privacy-safe roadmap without private metadata', () => {
		const published = filterPublishableItems(fixture.items, {
			milestoneAllowlist: new Set([allowedMilestone]),
			now,
		})
		const markdown = renderRoadmap(published)

		expect(markdown).toContain('## Now')
		expect(markdown).toContain('## Next')
		expect(markdown).toContain('## Later')
		expect(markdown).toContain('## Shipped')
		expect(markdown).not.toMatch(/#\d+/)
		expect(markdown).not.toMatch(/https?:\/\//i)
		expect(markdown).not.toMatch(/2026-\d{2}-\d{2}/)
		expect(markdown).not.toContain('Ada Example')
	})
})
