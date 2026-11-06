import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { BADGE_ICON_KEYS, badgeIconMarkup } from '../badge-icons.js'
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
	it('returns an 800x480 PNG', async () => {
		const png = await renderProfileCard(fullCard)
		expect(png.subarray(0, 8).equals(PNG_SIGNATURE)).toBe(true)
		const meta = await sharp(png).metadata()
		expect(meta.width).toBe(PROFILE_CARD_WIDTH)
		expect(meta.height).toBe(PROFILE_CARD_HEIGHT)
		expect(PROFILE_CARD_WIDTH).toBe(800)
		expect(PROFILE_CARD_HEIGHT).toBe(480)
	})

	it('renders every fixture without throwing', async () => {
		for (const card of [fullCard, emptyCard, stressCard]) {
			const meta = await sharp(await renderProfileCard(card)).metadata()
			expect([meta.width, meta.height]).toEqual([800, 480])
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
		expect(svg).toContain('5 EARNED')
		for (const badge of fullCard.badges) expect(svg).toContain(badge.name)
	})

	it('shows at most eight medallions, earned first and locked after', () => {
		const earned = ['e1', 'e2', 'e3'].map((name) => ({ name }))
		const locked = ['l1', 'l2', 'l3', 'l4', 'l5', 'l6'].map((name) => ({
			name,
		}))
		const svg = buildProfileCardSvg({
			...fullCard,
			badges: earned,
			locked,
			earnedCount: 3,
		})
		expect(MAX_PROFILE_BADGES).toBe(8)
		expect(svg).toContain('>e3<')
		expect(svg).toContain('>l5<')
		expect(svg).not.toContain('>l6<')
		expect(svg.indexOf('>e1<')).toBeLessThan(svg.indexOf('>l1<'))
	})

	it('keeps every medallion label inside its slot', () => {
		const svg = buildProfileCardSvg({
			...fullCard,
			badges: Array.from({ length: 8 }, (_, i) => ({
				name: `${'W'.repeat(40)}${i}`,
			})),
			locked: [],
			earnedCount: 8,
		})
		expect(svg).toContain('...')
		expect(svg).not.toContain('W'.repeat(40))
	})

	it('draws locked badges dimmed without the earned glow', () => {
		const svg = buildProfileCardSvg({
			...emptyCard,
			locked: [{ key: 'courtside', name: 'Courtside' }],
		})
		expect(svg).toContain('Courtside')
		expect(svg).not.toContain('filter="url(#blur)"')
		expect(svg).toContain(
			'No badges yet. Place a bet to start earning them.',
		)
	})

	it('colours the tier chip and glow by tier', () => {
		const gold = buildProfileCardSvg({ ...fullCard, tier: 'Gold' })
		const emerald = buildProfileCardSvg({ ...fullCard, tier: 'Emerald' })
		expect(gold).toContain('fill="#f5cf47"')
		expect(emerald).toContain('#3ddc97')
		expect(emerald).not.toContain('fill="#f5cf47"/>\n')
	})

	it('draws a distinct icon per achievement key and a star for unknown keys', () => {
		const keys = [
			'first_win',
			'ten_wins',
			'fifty_wins',
			'in_the_black',
			'sharp_eye',
			'prop_hunter',
			'parlay_pro',
			'courtside',
		]
		expect(BADGE_ICON_KEYS).toEqual(keys)
		const markup = new Set(keys.map((key) => badgeIconMarkup(key)))
		expect(markup.size).toBe(keys.length)
		expect(badgeIconMarkup('unknown_future_key')).toBe(
			badgeIconMarkup('first_win'),
		)
		expect(badgeIconMarkup(undefined)).toBe(badgeIconMarkup('first_win'))
		const svg = buildProfileCardSvg({
			...fullCard,
			badges: [{ key: 'courtside', name: 'Courtside' }],
		})
		expect(svg).toContain(badgeIconMarkup('courtside'))
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
