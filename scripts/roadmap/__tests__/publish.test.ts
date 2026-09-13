import { createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
	derivePublicId,
	filterPublishableItems,
	parseMilestoneAllowlist,
	publishRoadmap,
	readTombstones,
} from '../publish.js'

interface Fixture {
	items: Array<Record<string, unknown>>
}

const fixture = JSON.parse(
	readFileSync(resolve(import.meta.dirname, '../fixtures/export.sample.json'), 'utf8'),
) as Fixture
const allowedMilestone = '11111111-1111-4111-8111-111111111111'
const now = new Date('2026-09-13T00:00:00.000Z')
const testSecret = 'test-secret-'.repeat(3)
const env = {
	ROADMAP_ID_SECRET: testSecret,
	ROADMAP_MILESTONE_ALLOWLIST: allowedMilestone,
}

function publish(input: unknown = fixture, options: Record<string, unknown> = {}): string {
	return publishRoadmap(input, { env, now, ...options })
}

function item(overrides: Record<string, unknown> = {}): Record<string, unknown> {
	return {
		trackerId: 'tracker-test-001',
		title: 'Ship dark mode',
		labels: ['public'],
		milestoneId: allowedMilestone,
		status: 'Now',
		...overrides,
	}
}

describe('public roadmap publisher', () => {
	it('requires the public label and an allowed milestone', () => {
		const published = filterPublishableItems(fixture.items, {
			idSecret: testSecret,
			milestoneAllowlist: new Set([allowedMilestone]),
			now,
		})

		expect(published.map((entry) => entry.publicId)).toEqual([
			derivePublicId('tracker-now-001', testSecret),
			derivePublicId('tracker-next-001', testSecret),
			derivePublicId('tracker-later-001', testSecret),
			derivePublicId('tracker-shipped-001', testSecret),
		])
	})

	it('withdraws an item when the public label is removed', () => {
		const items = fixture.items.map((entry) =>
			entry.trackerId === 'tracker-now-001' ? { ...entry, labels: ['internal'] } : entry,
		)

		expect(publish(items)).not.toContain('Publish the roadmap')
	})

	it('withdraws an item when its milestone is not allowlisted', () => {
		const items = fixture.items.map((entry) =>
			entry.trackerId === 'tracker-next-001'
				? { ...entry, milestoneId: '22222222-2222-4222-8222-222222222222' }
				: entry,
		)

		expect(publish(items)).not.toContain('Improve onboarding')
	})

	it('withdraws an item listed by its derived opaque id', () => {
		const tombstone = derivePublicId('tracker-later-001', testSecret)

		expect(publish(fixture, { tombstones: new Set([tombstone]) })).not.toContain(
			'Explore mobile support',
		)
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

	it('publishes nothing for an empty milestone allowlist', () => {
		expect(publish(fixture, { env: { ...env, ROADMAP_MILESTONE_ALLOWLIST: '' } })).toContain(
			'- None currently listed',
		)
	})

	it('requires a sufficiently long id secret and never trusts raw ids', () => {
		const rawIdItem = item({ id: 'raw-tracker-id', trackerId: undefined })

		expect(() => publishRoadmap([rawIdItem], { env: { ROADMAP_MILESTONE_ALLOWLIST: allowedMilestone } })).toThrow()
		expect(() => publishRoadmap([rawIdItem], { env: { ...env, ROADMAP_ID_SECRET: 'short' } })).toThrow()
		expect(() => publishRoadmap([rawIdItem], { env: { ...env, ROADMAP_ID_SECRET: ' '.repeat(32) } })).toThrow()
	})

	it('publishes titles and opt-in summaries, never descriptions', () => {
		const markdown = publish([
			item({
				description: 'Private person, customer, tracker link, and dates must stay out.',
				publicSummary: 'A safe public summary',
			}),
		])

		expect(markdown).toContain('Ship dark mode')
		expect(markdown).toContain('A safe public summary')
		expect(markdown).not.toContain('Private person')
	})

	it.each([
		'abc-123',
		'ABC123',
		'#616',
		'TF 1547',
		'TF_1547',
		'PR 616',
		'issue 1547',
		'X-12',
		'tracker.example/item',
		'https://github.com/example/item',
		'discord.gg/example',
		'www.example.com',
		'person@example.com',
		'@handle',
		'123e4567-e89b-12d3-a456-426614174000',
		'Sept 13',
		'Sep 2026',
		'sept. 13',
		'13th Sep',
		'2026/09/13',
		'13.09.2026',
		'9/13',
		'Q3 2026',
		'20260913',
		'123e4567e89b12d3a456426614174000',
		'[x](mailto:person@example.com)',
		'[x](/private)',
		'[x](docs/private)',
	])('rejects unsafe public summary %s', (unsafeSummary) => {
		expect(() => publish([item({ title: unsafeSummary })])).toThrow()
		expect(() => publish([item({ publicSummary: unsafeSummary })])).toThrow()
	})

	it('does not mangle ordinary words while sanitizing markdown', () => {
		expect(publish([item()])).toContain('Ship dark mode')
	})

	it('collapses whitespace and renders HTML and markdown inert', () => {
		const markdown = publish([
			item({ publicSummary: 'A line\n## Pwned <img onerror="alert(1)">' }),
		])

		expect(markdown).not.toContain('\n## Pwned')
		expect(markdown).toContain('A line')
		expect(markdown).toContain('&lt;img onerror=&quot;alert\\(1\\)&quot;&gt;')
		expect(markdown).not.toContain('<img')
	})

	it('fails closed for malformed tombstone files and raw ids', () => {
		expect(readTombstones(['0123456789abcdef'])).toEqual(new Set(['0123456789abcdef']))
		expect(() => readTombstones({ tombstones: ['0123456789abcdef'] })).toThrow()
		expect(() => readTombstones(['not-a-public-id'])).toThrow()
		expect(() => readTombstones(['tracker-test-001'])).toThrow()
		expect(() => readTombstones(['0123456789abcdef', 42])).toThrow()
	})

	it('rejects unknown export shapes and exports with no recognizable statuses', () => {
		expect(() => publish({ data: { issues: { nodes: fixture.items } } })).toThrow()
		expect(() => publish([item({ status: 'Blocked' })])).toThrow()
	})

	it('maps tracker states to roadmap lanes and sorts titles', () => {
		const markdown = publish([
			item({ trackerId: 'tracker-z', title: 'Zed', status: 'In Progress' }),
			item({ trackerId: 'tracker-b', title: 'Another', status: 'In Progress' }),
			item({ trackerId: 'tracker-a', title: 'Alpha', status: 'Backlog' }),
			item({ trackerId: 'tracker-d', title: 'Done item', status: 'Done', completedAt: '2026-09-01' }),
		])

		expect(markdown.indexOf('Another')).toBeLessThan(markdown.indexOf('Zed'))
		expect(markdown).toContain('## Later\n- Alpha')
		expect(markdown).toContain('## Now\n- Another\n- Zed')
		expect(markdown).toContain('## Shipped\n- Done item')
	})

	it('trims labels consistently and requires an exact public label', () => {
		const labels = [
			['PUBLIC'],
			[' Public '],
			['publicity'],
			['not-public'],
			[{ name: ' Public ' }],
		] as const

		for (const [index, value] of labels.entries()) {
			const result = filterPublishableItems(
				[item({ trackerId: `tracker-label-${index}`, labels: value })],
				{ idSecret: testSecret, milestoneAllowlist: new Set([allowedMilestone]), now },
			)

			if (index < 2 || index === 4) {
				expect(result).toHaveLength(1)
			} else {
				expect(result).toHaveLength(0)
			}
		}
	})

	it('uses UTC for shipped dates, drops future dates, and does not reveal chronology', () => {
		const markdown = publish([
			item({ trackerId: 'tracker-future', title: 'Future', status: 'Done', completedAt: '2026-09-14T00:00:00' }),
			item({ trackerId: 'tracker-recent-z', title: 'Z recent', status: 'Done', completedAt: '2026-06-16T00:00:00' }),
			item({ trackerId: 'tracker-recent-a', title: 'A recent', status: 'Done', completedAt: '2026-08-20T00:00:00' }),
		])

		expect(markdown).not.toContain('Future')
		expect(markdown.indexOf('A recent')).toBeLessThan(markdown.indexOf('Z recent'))
	})

	it('derives ids with HMAC-SHA256 and truncates them to 16 hex characters', () => {
		const expected = createHmac('sha256', testSecret).update('tracker-test-001').digest('hex').slice(0, 16)

		expect(derivePublicId('tracker-test-001', testSecret)).toBe(expected)
	})
})
