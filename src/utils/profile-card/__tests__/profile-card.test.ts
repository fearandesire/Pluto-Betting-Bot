import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import {
	buildProfileCardSvg,
	MAX_PROFILE_BADGES,
	PROFILE_CARD_HEIGHT,
	PROFILE_CARD_WIDTH,
	renderProfileCard,
} from '../profile-card.js'
import { emptyCard, fullCard, stressCard } from './fixtures.js'

const PNG_SIGNATURE = Buffer.from([
	0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
])

describe('renderProfileCard', () => {
	it('returns an 800x420 PNG', async () => {
		const png = await renderProfileCard(fullCard)
		expect(png.subarray(0, 8).equals(PNG_SIGNATURE)).toBe(true)
		const meta = await sharp(png).metadata()
		expect(meta.width).toBe(PROFILE_CARD_WIDTH)
		expect(meta.height).toBe(PROFILE_CARD_HEIGHT)
		expect(PROFILE_CARD_WIDTH).toBe(800)
		expect(PROFILE_CARD_HEIGHT).toBe(420)
	})

	it('renders every fixture without throwing', async () => {
		for (const card of [fullCard, emptyCard, stressCard]) {
			const meta = await sharp(await renderProfileCard(card)).metadata()
			expect([meta.width, meta.height]).toEqual([800, 420])
		}
	})

	it('renders with no profile and no achievements', async () => {
		const png = await renderProfileCard({
			displayName: 'Ghost',
			tier: null,
			level: null,
			summary: null,
			badges: [],
		})
		expect((await sharp(png).metadata()).width).toBe(800)
	})
})

describe('buildProfileCardSvg', () => {
	it('shows name, initial, tier, stats and badge names', () => {
		const svg = buildProfileCardSvg(fullCard)
		expect(svg).toContain('FenixPlays')
		expect(svg).toContain('>F</text>')
		expect(svg).toContain('GOLD  -  LVL 38')
		expect(svg).toContain('18-11-2')
		expect(svg).toContain('+$1,342.50')
		expect(svg).toContain('$612.75')
		expect(svg).toContain('63%')
		expect(svg).toContain('8 EARNED')
		for (const badge of fullCard.badges) expect(svg).toContain(badge)
	})

	it('shows only the latest five badges', () => {
		const svg = buildProfileCardSvg({
			...fullCard,
			badges: ['b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7'],
		})
		expect(MAX_PROFILE_BADGES).toBe(5)
		expect(svg).toContain('>b5<')
		expect(svg).not.toContain('>b6<')
	})

	it('escapes markup in user-controlled names', () => {
		const svg = buildProfileCardSvg({
			...fullCard,
			displayName: '<script>&"x"',
		})
		expect(svg).not.toContain('<script>')
		expect(svg).toContain('&lt;script&gt;')
	})

	it('truncates names that cannot fit', () => {
		const svg = buildProfileCardSvg({
			...fullCard,
			displayName: 'W'.repeat(80),
		})
		expect(svg).not.toContain('W'.repeat(80))
		expect(svg).toContain('...')
	})

	it('colors net profit by sign and formats negatives', () => {
		const svg = buildProfileCardSvg(stressCard)
		expect(svg).toContain('-$123,456.78')
	})

	it('uses a placeholder avatar initial for symbol-only names', () => {
		expect(
			buildProfileCardSvg({ ...fullCard, displayName: '***' }),
		).toContain('>?</text>')
	})

	it('renders the no-bets, no-badges empty state', () => {
		const svg = buildProfileCardSvg(emptyCard)
		expect(svg).toContain('0-0-0')
		expect(svg).toContain(
			'No badges yet. Place a bet to start earning them.',
		)
		expect(svg).not.toContain('EARNED')
	})

	it('renders the no-badges state for a user who has bet', () => {
		const svg = buildProfileCardSvg({
			...fullCard,
			badges: [],
			earnedCount: 0,
		})
		expect(svg).toContain('No badges earned yet.')
	})

	it('omits the tier pill and dashes stats when data is missing', () => {
		const svg = buildProfileCardSvg({
			displayName: 'Ghost',
			tier: null,
			level: null,
			summary: null,
			badges: [],
		})
		expect(svg).not.toContain('LVL')
		expect(svg).toContain('>-</text>')
	})
})
