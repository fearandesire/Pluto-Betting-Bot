import { ButtonStyle, MessageFlags } from 'discord.js'
import { describe, expect, it } from 'vitest'
import {
	expectV2Payload,
	toJsonComponents,
} from '../../../../test/helpers/v2-assert.js'
import { assertV2Budget } from '../kit.js'
import {
	decodePageNav,
	encodePageNav,
	getPageSource,
	registerPageSource,
	renderPage,
} from '../paginator.js'

type Json = {
	type: number
	content?: string
	custom_id?: string
	style?: number
	disabled?: boolean
	components?: Json[]
}

const lines = (n: number) => Array.from({ length: n }, (_, i) => `row ${i}`)

function children(p: ReturnType<typeof renderPage>): Json[] {
	const [container] = toJsonComponents(p) as Json[]
	return container.components ?? []
}

function navButtons(p: ReturnType<typeof renderPage>): Json[] {
	const row = children(p).find((c) => c.type === 1)
	return row?.components ?? []
}

describe('page nav codec', () => {
	it('round-trips every action', () => {
		for (const action of ['first', 'prev', 'next', 'last'] as const) {
			const route = { scope: 'lb-balance', page: 7, action }
			expect(decodePageNav(encodePageNav(route))).toEqual(route)
		}
	})

	it('uses the pg.v1 grammar', () => {
		expect(
			encodePageNav({ scope: 'lb-balance', page: 0, action: 'next' }),
		).toBe('pg.v1.lb-balance.0.next')
	})

	it('stays within 100 chars at the widest scope and page', () => {
		const id = encodePageNav({
			scope: 'a'.repeat(32),
			page: Number.MAX_SAFE_INTEGER,
			action: 'first',
		})
		expect(id.length).toBeLessThanOrEqual(100)
	})

	it('throws on a scope or page the decoder would reject', () => {
		expect(() =>
			encodePageNav({ scope: 'Bad.Scope', page: 0, action: 'next' }),
		).toThrow()
		expect(() =>
			encodePageNav({ scope: 'a'.repeat(33), page: 0, action: 'next' }),
		).toThrow()
		expect(() =>
			encodePageNav({ scope: 'ok', page: -1, action: 'next' }),
		).toThrow()
		expect(() =>
			encodePageNav({ scope: 'ok', page: 1.5, action: 'next' }),
		).toThrow()
	})

	it.each([
		['wrong namespace', 'px.v1.lb.0.next'],
		['wrong version', 'pg.v2.lb.0.next'],
		['unknown action', 'pg.v1.lb.0.jump'],
		['extra token', 'pg.v1.lb.0.next.x'],
		['missing token', 'pg.v1.lb.0'],
		['negative page', 'pg.v1.lb.-1.next'],
		['non-numeric page', 'pg.v1.lb.abc.next'],
		['leading-zero page', 'pg.v1.lb.01.next'],
		['fractional page', 'pg.v1.lb.1e3.next'],
		['uppercase scope', 'pg.v1.LB.0.next'],
		['empty scope', 'pg.v1..0.next'],
		['unrelated id', 'prop_abc'],
		['another codec', 'parlay:v1:place:abc'],
	])('rejects %s', (_label, id) => {
		expect(decodePageNav(id)).toBeNull()
	})
})

describe('renderPage', () => {
	const V2 = MessageFlags.IsComponentsV2

	it('renders title, joined body, footer and a 4-button nav row', () => {
		const p = renderPage({
			scope: 'lb-balance',
			title: 'Leaderboard',
			lines: lines(25),
			page: 1,
			perPage: 10,
			footerText: 'Pluto',
		})
		// container + title + body + footer + row + 4 buttons
		expectV2Payload(p, { flags: V2, components: 9 })
		const [title, body, foot] = children(p)
		expect(title.content).toBe('## Leaderboard')
		expect(body.content).toBe(lines(25).slice(10, 20).join('\n'))
		expect(foot.content).toBe('-# Pluto · Page 2/3')
	})

	it('nav buttons are Secondary and target the destination page', () => {
		const p = renderPage({
			scope: 'lb-balance',
			title: 'T',
			lines: lines(25),
			page: 1,
			perPage: 10,
		})
		const buttons = navButtons(p)
		expect(buttons.map((b) => b.custom_id)).toEqual([
			'pg.v1.lb-balance.0.first',
			'pg.v1.lb-balance.0.prev',
			'pg.v1.lb-balance.2.next',
			'pg.v1.lb-balance.2.last',
		])
		for (const b of buttons) {
			expect(b.style).toBe(ButtonStyle.Secondary)
			expect(b.disabled).toBe(false)
		}
	})

	it('disables first/prev on page 0', () => {
		const p = renderPage({
			scope: 's',
			title: 'T',
			lines: lines(25),
			page: 0,
			perPage: 10,
		})
		expect(navButtons(p).map((b) => b.disabled)).toEqual([
			true,
			true,
			false,
			false,
		])
	})

	it('disables next/last on the last page', () => {
		const p = renderPage({
			scope: 's',
			title: 'T',
			lines: lines(25),
			page: 2,
			perPage: 10,
		})
		expect(navButtons(p).map((b) => b.disabled)).toEqual([
			false,
			false,
			true,
			true,
		])
	})

	it('clamps an out-of-range page to the last page', () => {
		const p = renderPage({
			scope: 's',
			title: 'T',
			lines: lines(25),
			page: 99,
			perPage: 10,
		})
		expect(children(p)[1].content).toBe(lines(25).slice(20).join('\n'))
		expect(children(p)[2].content).toBe('-# Page 3/3')
	})

	it('clamps a negative page to 0', () => {
		const p = renderPage({
			scope: 's',
			title: 'T',
			lines: lines(25),
			page: -4,
			perPage: 10,
		})
		expect(children(p)[2].content).toBe('-# Page 1/3')
	})

	it('single page has no nav row', () => {
		const p = renderPage({
			scope: 's',
			title: 'T',
			lines: lines(3),
			page: 0,
			perPage: 10,
		})
		// container + title + body + footer
		expectV2Payload(p, { flags: V2, components: 4 })
		expect(children(p).some((c) => c.type === 1)).toBe(false)
	})

	it('empty lines render a placeholder and no nav row', () => {
		const p = renderPage({
			scope: 's',
			title: 'T',
			lines: [],
			page: 3,
			perPage: 10,
		})
		// container + title + placeholder
		expectV2Payload(p, { flags: V2, components: 3 })
		expect(children(p)[1].content).toBe('Nothing to show yet.')
	})

	it('adds Ephemeral when asked and passes accent through', () => {
		const p = renderPage({
			scope: 's',
			title: 'T',
			lines: lines(3),
			page: 0,
			perPage: 10,
			ephemeral: true,
			accent: 0x123456,
		})
		expectV2Payload(p, {
			flags: V2 | MessageFlags.Ephemeral,
			components: 4,
		})
		const [container] = toJsonComponents(p) as Array<{
			accent_color?: number
		}>
		expect(container.accent_color).toBe(0x123456)
	})

	it('500 long lines on one page stay within the V2 budget and keep nav', () => {
		const long = Array.from(
			{ length: 500 },
			(_, i) => `${i} ${'x'.repeat(80)}`,
		)
		const p = renderPage({
			scope: 's',
			title: 'T',
			lines: long,
			page: 0,
			perPage: 500,
		})
		expect(() => assertV2Budget(p)).not.toThrow()
		expect(children(p)[2].content).toBe('-# Page 1/1')

		const paged = renderPage({
			scope: 's',
			title: 'T',
			lines: long,
			page: 3,
			perPage: 20,
		})
		expect(() => assertV2Budget(paged)).not.toThrow()
		expect(navButtons(paged)).toHaveLength(4)
	})
})

describe('page source registry', () => {
	it('returns registered sources and undefined for unknown scopes', () => {
		const source = { load: async () => ({}) as never, ownerOnly: true }
		registerPageSource('registry-test', source)
		expect(getPageSource('registry-test')).toBe(source)
		expect(getPageSource('nope')).toBeUndefined()
	})
})
