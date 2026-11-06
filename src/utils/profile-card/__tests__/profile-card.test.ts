import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import {
	ACHIEVEMENT_ART_KEYS,
	achievementPresentation,
} from '../achievement-art.js'
import {
	buildProfileCardSvg,
	describeProfileCard,
	MAX_PROFILE_BADGES,
	PROFILE_CARD_HEIGHT,
	PROFILE_CARD_WIDTH,
	renderProfileCard,
} from '../profile-card.js'
import { emptyCard, fullCard, stressCard } from './fixtures.js'

const unavailable = {
	...fullCard,
	tier: null,
	level: null,
	summary: null,
	badges: [],
}

// These are the published Khronos keys, not locally invented award criteria.
const expectedNames = {
	first_win: 'Opening Score',
	ten_wins: 'Double Figures',
	fifty_wins: 'Club Fifty',
	in_the_black: 'In the Black',
	sharp_eye: 'The Line Reader',
	prop_hunter: 'Player’s Edge',
	parlay_pro: 'All Legs Home',
	courtside: 'Courtside',
}

describe('profile artwork', () => {
	it('gives every published achievement a distinct original illustration', async () => {
		expect(ACHIEVEMENT_ART_KEYS).toEqual(Object.keys(expectedNames))
		const illustrations = new Set<string>()
		for (const [key, name] of Object.entries(expectedNames)) {
			const art = achievementPresentation({ key, name: 'API name' })
			expect(art.name).toBe(name)
			illustrations.add(art.markup)
			const svg = buildProfileCardSvg({
				...fullCard,
				badges: [{ key, name: 'API name' }],
			})
			expect(svg).toContain(name)
			expect(
				(
					await sharp(
						await renderProfileCard({
							...fullCard,
							badges: [{ key, name }],
						}),
					).metadata()
				).width,
			).toBe(PROFILE_CARD_WIDTH)
		}
		expect(illustrations.size).toBe(8)
	})

	it('keeps future and prototype-like keys generic without falsely identifying an award', () => {
		for (const key of [
			'future_key',
			'constructor',
			'__proto__',
			'toString',
			undefined,
		]) {
			const art = achievementPresentation({
				key,
				name: 'Future Award',
				description: 'New criterion',
			})
			expect(art.name).toBe('Future Award')
			expect(art.caption).toBe('New criterion')
			expect(art.markup).not.toContain('function')
		}
	})
})

describe('renderProfileCard', () => {
	it('renders native PNGs below the existing 2 MiB sharing limit in every state', async () => {
		for (const card of [fullCard, emptyCard, stressCard, unavailable]) {
			const png = await renderProfileCard(card)
			const meta = await sharp(png).metadata()
			expect(meta.format).toBe('png')
			expect([meta.width, meta.height]).toEqual([1000, 800])
			expect([PROFILE_CARD_WIDTH, PROFILE_CARD_HEIGHT]).toEqual([
				1000, 800,
			])
			expect(png.byteLength).toBeLessThan(2 * 1024 * 1024)
		}
	})
})

describe('buildProfileCardSvg', () => {
	it('uses authoritative stats and a presentation alias with an accurate criterion', () => {
		const svg = buildProfileCardSvg(fullCard)
		for (const value of [
			'FenixPlays',
			'GOLD / LEVEL 38',
			'18–11–2',
			'+$1,342.50',
			'$612.75',
			'63%',
			'5 EARNED',
		])
			expect(svg).toContain(value)
		for (const badge of fullCard.badges)
			expect(svg).toContain(achievementPresentation(badge).name)
		expect(svg).toContain('First winning parlay')
		expect(svg).not.toContain('locked')
	})

	it('keeps exactly the latest five earned awards and the full count', () => {
		const svg = buildProfileCardSvg({
			...fullCard,
			badges: Array.from({ length: 8 }, (_, i) => ({
				name: `Award ${i + 1}`,
			})),
			earnedCount: 8,
		})
		expect(MAX_PROFILE_BADGES).toBe(5)
		expect(svg).toContain('Award 5')
		expect(svg).not.toContain('Award 6')
		expect(svg).toContain('8 EARNED / LATEST 5')
	})

	it('bounds all long names and tier labels, escapes XML and removes hidden controls', async () => {
		const png = await renderProfileCard({
			...stressCard,
			displayName: '\u202e<svg>&"x"\u0001',
			tier: 'W'.repeat(1000),
			badges: [
				{
					name: '<script>&'.repeat(1000),
					description: '世'.repeat(1000),
				},
			],
		})
		expect((await sharp(png).metadata()).format).toBe('png')
		const svg = buildProfileCardSvg({
			...fullCard,
			displayName: '\u202e<script>&"x"\u0001',
		})
		expect(svg).not.toContain('<script>')
		expect(svg).toContain('&lt;script&gt;')
		expect(svg).not.toContain('\u202e')
		expect(svg).not.toContain('\u0001')
		expect(buildProfileCardSvg(stressCard)).toContain('…')
	})

	it('uses a signed value as well as a color for negative net profit', () => {
		expect(buildProfileCardSvg(stressCard)).toContain('−$123,456.78')
	})

	it('distinguishes a fresh record from an unavailable service', () => {
		const empty = buildProfileCardSvg(emptyCard)
		const missing = buildProfileCardSvg(unavailable)
		expect(empty).toContain('0–0–0')
		expect(empty).toContain('A fresh scorecard.')
		expect(empty).toContain('0 EARNED')
		expect(missing).toContain('DATA UNAVAILABLE')
		expect(missing).toContain('Achievement data could not be loaded.')
		expect(missing).not.toContain('0–0–0')
		expect(missing).not.toContain('0 EARNED')
	})

	it('keeps null hit rates and payouts unknown rather than zero', () => {
		const alt = describeProfileCard(emptyCard)
		expect(alt).toContain('BEST WIN: —')
		expect(alt).toContain('HIT RATE: —')
	})

	it('includes a bounded text equivalent of stats and achievements for Discord', () => {
		const alt = describeProfileCard(fullCard)
		expect(alt).toContain('NET PROFIT: +$1,342.50')
		expect(alt).toContain('All Legs Home (First winning parlay)')
		expect(alt).toContain('Achievements are cosmetic.')
		expect(
			describeProfileCard({
				...stressCard,
				displayName: 'W'.repeat(10000),
			}).length,
		).toBeLessThanOrEqual(1024)
	})
})
