import { MessageFlags } from 'discord.js'
import { describe, expect, it } from 'vitest'
import { buildBadgeEmojiRegistry } from '../../../badges/badge-emoji-registry.js'
import { BADGE_PRESENTATION } from '../../../badges/badge-presentation.js'
import {
	type AchievementsView,
	type BadgeView,
	buildAchievementsView,
} from '../../../badges/badge-view.js'
import {
	countComponents,
	expectV2Payload,
	sumTextDisplayChars,
	toJsonComponents,
} from '../../v2/__tests__/v2-assert.js'
import {
	achievementsPageCount,
	achievementsPayload,
	decodeAchievementsPage,
	decodeAchievementsView,
	encodeAchievementsPage,
	encodeAchievementsView,
	profileBadgeLine,
} from '../achievements.js'

const ID = '123456789012345678'

const badge = (over: Partial<BadgeView>): BadgeView => ({
	key: 'first_win',
	label: 'Opening Score',
	criteria: 'Win a head-to-head bet.',
	kind: 'career',
	state: 'earned',
	emoji: null,
	art: null,
	awardedAt: null,
	gates: [],
	...over,
})

const texts = (payload: unknown) => {
	const [container] = toJsonComponents(payload as never) as Array<{
		components?: Array<{ content?: string }>
	}>
	return (container.components ?? []).map((c) => c.content ?? '')
}

const view = (over: Partial<AchievementsView> = {}): AchievementsView => ({
	earned: [],
	locked: [],
	total: 0,
	...over,
})

describe('achievements view custom id', () => {
	it('round-trips and rejects anything else', () => {
		const id = encodeAchievementsView('22222222222222222')
		expect(id).toBe('ach.v1.view.22222222222222222')
		expect(decodeAchievementsView(id)).toBe('22222222222222222')
		expect(
			decodeAchievementsView('ach.v2.view.22222222222222222'),
		).toBeNull()
		expect(decodeAchievementsView('profile.v1.share.1.2')).toBeNull()
		expect(decodeAchievementsView('ach.v1.view.abc')).toBeNull()
		expect(
			decodeAchievementsView('ach.v1.view.22222222222222222.x'),
		).toBeNull()
		expect(() => encodeAchievementsView('abc')).toThrow()
	})

	it('round-trips a page id and keeps it apart from the opening id', () => {
		const id = encodeAchievementsPage('22222222222222222', 3)
		expect(id).toBe('ach.v1.view.22222222222222222.3')
		expect(decodeAchievementsPage(id)).toEqual({
			targetId: '22222222222222222',
			page: 3,
		})
		expect(decodeAchievementsView(id)).toBeNull()
		expect(
			decodeAchievementsPage('ach.v1.view.22222222222222222'),
		).toBeNull()
		expect(
			decodeAchievementsPage('ach.v1.view.22222222222222222.x'),
		).toBeNull()
		expect(() => encodeAchievementsPage('22222222222222222', -1)).toThrow()
	})
})

describe('achievementsPayload', () => {
	const earnedBlack = badge({
		key: 'in_the_black',
		label: 'In the Black',
		criteria:
			'Hold a positive net profit across at least 10 settled head-to-head bets.',
		kind: 'form',
		emoji: `<:p_in_the_black:${ID}>`,
	})
	const lockedLine = badge({
		key: 'sharp_eye',
		label: 'The Line Reader',
		criteria:
			'Keep a hit rate of 60% or better across at least 20 settled predictions.',
		kind: 'form',
		state: 'locked',
		gates: [
			{ label: 'Settled predictions', text: '20/20', met: true },
			{ label: 'Prediction hit rate', text: '55.0% of 60%', met: false },
		],
	})

	it('lists earned and locked badges with gates', () => {
		const payload = achievementsPayload(
			view({
				earned: [
					badge({ emoji: `<:p_opening_score:${ID}>` }),
					earnedBlack,
				],
				locked: [lockedLine],
				total: 3,
			}),
			'Harbor',
		)
		expectV2Payload(payload, {
			flags: MessageFlags.IsComponentsV2,
			components: 5,
		})
		expect(texts(payload)).toEqual([
			'## Achievements: Harbor\n-# 2 of 3 badges earned',
			`**Earned**\n<:p_opening_score:${ID}> **Opening Score**: Win a head-to-head bet.\n<:p_in_the_black:${ID}> **In the Black**: Hold a positive net profit across at least 10 settled head-to-head bets. You keep it only while you still qualify.`,
			'**Still to earn**\n**The Line Reader**: Keep a hit rate of 60% or better across at least 20 settled predictions.\n-# Settled predictions 20/20 (done) · Prediction hit rate 55.0% of 60%',
			'-# Badges are just for show. Pluto updates them when you open a profile or this list.',
		])
	})

	it('falls back to names when no emoji resolves', () => {
		const payload = achievementsPayload(
			view({ earned: [badge({})], total: 1 }),
			'Harbor',
		)
		expect(texts(payload)[1]).toBe(
			'**Earned**\n**Opening Score**: Win a head-to-head bet.',
		)
	})

	it('shows None yet and All earned empty states', () => {
		const none = texts(
			achievementsPayload(view({ locked: [lockedLine], total: 1 }), 'H'),
		)
		expect(none[1]).toBe('**Earned**\nNone yet.')
		const all = texts(
			achievementsPayload(view({ earned: [badge({})], total: 1 }), 'H'),
		)
		expect(all[2]).toBe('**Still to earn**\nAll earned.')
	})

	it('escapes markdown in the display name and sends no pings', () => {
		const payload = achievementsPayload(view(), '**@everyone**')
		expect(texts(payload)[0]).toContain('\\*\\*@everyone\\*\\*')
		expect(payload.allowedMentions).toEqual({ parse: [] })
	})

	it('splits a 30-badge worst case into pages that keep every rule', () => {
		const long = 'x'.repeat(180)
		const make = (i: number, state: 'earned' | 'locked'): BadgeView =>
			badge({
				key: `k${i}`,
				label: `Badge Number ${i}`,
				criteria: `${long}${i}`,
				kind: i % 2 ? 'form' : 'career',
				state,
				emoji: `<:p_opening_score:${ID}>`,
				gates:
					state === 'locked'
						? [
								{
									label: 'Settled predictions',
									text: '20/20',
									met: true,
								},
								{
									label: 'Prediction hit rate',
									text: '55.0% of 60%',
									met: false,
								},
							]
						: [],
			})
		const earned = Array.from({ length: 10 }, (_, i) => make(i, 'earned'))
		const locked = Array.from({ length: 20 }, (_, i) =>
			make(i + 10, 'locked'),
		)
		const v = view({ earned, locked, total: 30 })
		const pages = achievementsPageCount(v, 'Harbor')
		expect(pages).toBeGreaterThan(1)

		const seen: string[] = []
		for (let page = 0; page < pages; page++) {
			const payload = achievementsPayload(v, 'Harbor', {
				targetId: ID,
				page,
			})
			const body = texts(payload).join('\n')
			seen.push(body)
			expect(texts(payload)[0]).toContain(`Page ${page + 1} of ${pages}`)
			const components = toJsonComponents(payload as never)
			expect(sumTextDisplayChars(components)).toBeLessThanOrEqual(4000)
			expect(countComponents(components)).toBeLessThanOrEqual(40)
		}
		const all = seen.join('\n')
		for (const b of [...earned, ...locked]) {
			expect(all.split(`**${b.label}**: ${b.criteria}`)).toHaveLength(2)
		}
		expect(all.split('Prediction hit rate 55.0% of 60%')).toHaveLength(21)
		expect(all).toContain('You keep it only while you still qualify.')
		expect(all).not.toContain('·  Settled')
	})

	it('pages the real 30-badge catalogue with every rule and progress line', () => {
		const registry = buildBadgeEmojiRegistry(
			Object.values(BADGE_PRESENTATION).map((b) => ({
				name: b.emojiName,
				id: ID,
			})),
		)
		const untracked = new Set([
			'underdog',
			'home_turf',
			'photo_finish',
			'cashout_regret',
		])
		const locked = Object.entries(BADGE_PRESENTATION).map(([key, b]) => ({
			key,
			name: b.label,
			description: b.criteria,
			kind: b.kind,
			track: 'h2h',
			progress: 0,
			target: 1,
			gates: [
				{
					metric: key,
					label: b.progressLabel,
					unit: 'count',
					comparator: 'gte',
					target: 1000,
					current: untracked.has(key) ? null : 999,
					met: false,
					tracked: !untracked.has(key),
				},
			],
		}))
		const v = buildAchievementsView(
			{
				user_id: ID,
				earned: [],
				locked,
				summary: {
					settled_bets: 0,
					wins: 0,
					losses: 0,
					pushes: 0,
					net_profit: 0,
					best_win_payout: null,
					settled_predictions: 0,
					prediction_hit_rate: null,
				},
			},
			registry,
		)
		expect(v.total).toBe(30)
		const pages = achievementsPageCount(v, 'A'.repeat(32))
		const seen: string[] = []
		for (let page = 0; page < pages; page++) {
			const payload = achievementsPayload(v, 'A'.repeat(32), {
				targetId: ID,
				page,
			})
			const components = toJsonComponents(payload as never)
			expect(sumTextDisplayChars(components)).toBeLessThanOrEqual(4000)
			expect(countComponents(components)).toBeLessThanOrEqual(40)
			seen.push(texts(payload).join('\n'))
		}
		const all = seen.join('\n')
		for (const [key, b] of Object.entries(BADGE_PRESENTATION)) {
			expect(all, key).toContain(`**${b.label}**: ${b.criteria}`)
			expect(all, key).toContain(`<:${b.emojiName}:${ID}>`)
		}
		expect(all.split('progress not tracked yet')).toHaveLength(5)
		expect(all.split('999/1000')).toHaveLength(27)
	})

	it('shows Previous and Next only when the list spans pages', () => {
		const single = achievementsPayload(view({}), 'Harbor', { targetId: ID })
		expect(JSON.stringify(toJsonComponents(single as never))).not.toContain(
			'Previous',
		)
		const long = 'x'.repeat(180)
		const many = Array.from({ length: 30 }, (_, i) =>
			badge({ key: `k${i}`, label: `B${i}`, criteria: long }),
		)
		const v = view({ earned: many, locked: [], total: 30 })
		const first = JSON.stringify(
			toJsonComponents(
				achievementsPayload(v, 'Harbor', {
					targetId: ID,
					page: 0,
				}) as never,
			),
		)
		expect(first).toContain(`ach.v1.view.${ID}.1`)
		expect(first).toContain('Previous')
	})
})

describe('profileBadgeLine', () => {
	it('lists leading earned badges then the count, omitting missing emoji', () => {
		const v = buildAchievementsView(
			{
				user_id: 'u',
				earned: ['first_win', 'fifty_wins'].map((key) => ({
					key,
					name: key,
					description: '',
					awarded_at: 'x',
				})),
				locked: [
					{
						key: 'ten_wins',
						name: 'x',
						description: 'y',
						progress: 1,
						target: 10,
					},
				],
				summary: {
					settled_bets: 0,
					wins: 0,
					losses: 0,
					pushes: 0,
					net_profit: 0,
					best_win_payout: null,
					settled_predictions: 0,
					prediction_hit_rate: null,
				},
			},
			buildBadgeEmojiRegistry([
				{ name: BADGE_PRESENTATION.first_win.emojiName, id: ID },
			]),
		)
		expect(profileBadgeLine(v, 5)).toBe(
			`<:p_opening_score:${ID}> Opening Score · Club Fifty · 2 of 3 badges`,
		)
		expect(profileBadgeLine(v, 1)).toBe(
			`<:p_opening_score:${ID}> Opening Score · 2 of 3 badges`,
		)
	})
})
