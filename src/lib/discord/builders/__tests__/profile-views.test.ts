import { MessageFlags } from 'discord.js'
import { describe, expect, it } from 'vitest'
import type { AchievementsView, BadgeView } from '../../../badges/badge-view.js'
import {
	countComponents,
	expectV2Payload,
	toJsonComponents,
} from '../../v2/__tests__/v2-assert.js'
import { assertV2Budget } from '../../v2/kit.js'
import {
	type ProfileViewModel,
	profileSettingsPayload,
	profileSharedViewPayload,
	profileViewPayload,
} from '../profile-views.js'

const OWNER = '123456789012345678'

const earned = (n: number): BadgeView => ({
	key: `earned_${n}`,
	label: `Earned ${n}`,
	criteria: `Do thing ${n}.`,
	kind: 'career',
	state: 'earned',
	emoji: null,
	art: `https://cdn.discordapp.com/emojis/9000000000000000${String(n).padStart(2, '0')}.png`,
	awardedAt: `2026-10-${String(Math.min(n + 1, 28)).padStart(2, '0')}T12:00:00.000Z`,
	gates: [],
})

const open = (n: number): BadgeView => ({
	...earned(n),
	key: `open_${n}`,
	label: `Open ${n}`,
	state: 'locked',
	awardedAt: null,
	gates: [{ label: 'Wins', text: '3/10', met: false }],
})

const model = (earnedCount: number, lockedCount: number): ProfileViewModel => {
	const a: AchievementsView = {
		earned: Array.from({ length: earnedCount }, (_, i) => earned(i + 1)),
		locked: Array.from({ length: lockedCount }, (_, i) => open(i + 1)),
		total: earnedCount + lockedCount,
	}
	return {
		userId: OWNER,
		displayName: 'Carl',
		avatarUrl: 'https://cdn.discordapp.com/embed/avatars/0.png',
		balance: 12480.5,
		level: 23,
		tier: 'Gold',
		stats: { wins: 64, losses: 41, pushes: 3, netProfit: 2318.4 },
		achievements: a,
	}
}

const route = { ownerId: OWNER }
const V2 = MessageFlags.IsComponentsV2

const flat = (payload: unknown): string =>
	JSON.stringify(toJsonComponents(payload as never))
const buttons = (payload: unknown) => {
	const found: Array<{
		label?: string
		custom_id?: string
		disabled?: boolean
	}> = []
	const walk = (n: unknown) => {
		if (!n || typeof n !== 'object') return
		const node = n as Record<string, unknown>
		if (node.type === 2) found.push(node as never)
		for (const v of Object.values(node)) {
			if (Array.isArray(v)) v.forEach(walk)
			else walk(v)
		}
	}
	toJsonComponents(payload as never).forEach(walk)
	return found
}

describe.each(['headline', 'trophy_shelf'] as const)('%s collapsed', (view) => {
	it('lists the latest three and offers Show all', () => {
		const payload = profileViewPayload({ view, model: model(9, 1), route })
		assertV2Budget(payload)
		expect(payload.flags).toBe(V2)
		const json = flat(payload)
		for (const n of [1, 2, 3]) expect(json).toContain(`Earned ${n}`)
		expect(json).not.toContain('Earned 4')
		expect(json).toContain('9 of 10 earned')
		const labels = buttons(payload).map((b) => b.label)
		expect(labels.some((l) => l?.startsWith('Show all'))).toBe(true)
		expect(labels).toContain('Share to channel')
		expect(labels).toContain('Settings')
	})

	it('shows what a few achievements look like without a cut', () => {
		const payload = profileViewPayload({ view, model: model(2, 3), route })
		const json = flat(payload)
		expect(json).toContain('Earned 1')
		expect(json).toContain('Earned 2')
		expect(json).toContain('2 of 5 earned')
	})

	it('has an empty state that points at the first achievement', () => {
		const payload = profileViewPayload({ view, model: model(0, 3), route })
		const json = flat(payload)
		expect(json).toContain('Open 1')
		expect(json).toContain('0 of 3 earned')
		expect(json).not.toContain('Earned 1')
		expect(
			buttons(payload).some((b) => b.label?.startsWith('Show all')),
		).toBe(true)
	})

	it("hides Settings on someone else's profile", () => {
		const m = { ...model(1, 0), userId: '22222222222222222' }
		const labels = buttons(
			profileViewPayload({ view, model: m, route }),
		).map((b) => b.label)
		expect(labels).not.toContain('Settings')
		expect(labels).toContain('Share to channel')
	})

	it('says so when achievements are unavailable', () => {
		const m = { ...model(0, 0), achievements: null }
		const payload = profileViewPayload({ view, model: m, route })
		expect(flat(payload)).toContain('Unavailable right now')
		assertV2Budget(payload)
	})

	it('never draws a pill or chip', () => {
		const json = flat(
			profileViewPayload({ view, model: model(9, 1), route }),
		)
		expect(json).not.toMatch(/`[^`]+`|\[[A-Z ]+\]/)
	})

	it('stays inside the component and text limits at the worst case', () => {
		const worst = model(30, 30)
		for (const expanded of [false, true]) {
			for (let page = 0; page < 12; page++) {
				const payload = profileViewPayload({
					view,
					model: worst,
					route,
					expanded,
					page,
				})
				assertV2Budget(payload)
				expect(
					countComponents(toJsonComponents(payload)),
				).toBeLessThanOrEqual(40)
			}
		}
	})

	it('drops controls and names the sharer on the public copy', () => {
		const payload = profileSharedViewPayload(
			{ view, model: model(9, 1), route },
			'33333333333333333',
		)
		expect(buttons(payload)).toEqual([])
		expect(flat(payload)).toContain('Shared by <@33333333333333333>')
		expect(payload.allowedMentions).toEqual({ parse: [] })
	})

	it('disables Share once shared', () => {
		const share = buttons(
			profileViewPayload({
				view,
				model: model(3, 0),
				route,
				shared: true,
			}),
		).find((b) => b.label === 'Shared')
		expect(share?.disabled).toBe(true)
	})
})

describe('headline', () => {
	it('exact shape of the collapsed card', () => {
		// container, header section (text x3 + thumbnail), divider, section
		// (text x2 + button), one text, action row with Share and Settings.
		expectV2Payload(
			profileViewPayload({ view: 'headline', model: model(9, 1), route }),
			{ flags: V2, components: 15 },
		)
	})

	it('expands to every achievement and a Show less button, without Share', () => {
		const payload = profileViewPayload({
			view: 'headline',
			model: model(9, 1),
			route,
			expanded: true,
		})
		const json = flat(payload)
		expect(json).toContain('Earned 9')
		expect(json).toContain('Open 1')
		const labels = buttons(payload).map((b) => b.label)
		expect(labels).toEqual(['Show less'])
	})
})

describe('trophy shelf', () => {
	it('exact shape of the collapsed card', () => {
		expectV2Payload(
			profileViewPayload({
				view: 'trophy_shelf',
				model: model(9, 1),
				route,
			}),
			{ flags: V2, components: 29 },
		)
	})

	it('pages the full list five at a time, then back to the shelf', () => {
		const first = profileViewPayload({
			view: 'trophy_shelf',
			model: model(7, 3),
			route,
			expanded: true,
			page: 0,
		})
		expect(flat(first)).toContain('Page 1 of 2')
		expect(buttons(first).map((b) => [b.label, b.disabled])).toEqual([
			['Previous', true],
			['Next', false],
			['Show less', false],
		])
		const second = profileViewPayload({
			view: 'trophy_shelf',
			model: model(7, 3),
			route,
			expanded: true,
			page: 1,
		})
		expect(flat(second)).toContain('Page 2 of 2')
		expect(flat(second)).toContain('Open 3')
		expect(buttons(second).map((b) => b.disabled)).toEqual([
			false,
			true,
			false,
		])
	})

	it('falls back to text when an achievement has no art', () => {
		const m = model(1, 0)
		m.achievements = {
			...m.achievements!,
			earned: [{ ...m.achievements!.earned[0], art: null }],
		}
		const payload = profileViewPayload({
			view: 'trophy_shelf',
			model: m,
			route,
		})
		expect(flat(payload)).toContain('Earned 1')
		assertV2Budget(payload)
	})
})

describe('settings', () => {
	it('marks the current default and reports a save', () => {
		const payload = profileSettingsPayload({
			ownerId: OWNER,
			current: 'trophy_shelf',
			saved: true,
			ephemeral: true,
		})
		expect(payload.flags).toBe(V2 | MessageFlags.Ephemeral)
		const json = flat(payload)
		expect(json).toContain('Saved. Your default is Trophy Shelf.')
		expect(json).toContain(`profile.v2.setview.${OWNER}`)
		expect(json).toMatch(/"value":"trophy_shelf"[^}]*"default":true/)
		expect(json).toMatch(/"value":"headline"[^}]*"default":false/)
	})
})
