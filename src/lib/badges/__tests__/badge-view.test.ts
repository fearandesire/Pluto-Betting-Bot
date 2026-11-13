import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type {
	LockedAchievement,
	UserAchievementsDto,
} from '../../../utils/api/Khronos/achievements/achievements-wrapper.js'
import { buildBadgeEmojiRegistry } from '../badge-emoji-registry.js'
import { BADGE_PRESENTATION } from '../badge-presentation.js'
import { buildAchievementsView, formatGate } from '../badge-view.js'

const ID = '123456789012345678'
const none = buildBadgeEmojiRegistry([])

const summary = {
	settled_bets: 0,
	wins: 0,
	losses: 0,
	pushes: 0,
	net_profit: 0,
	best_win_payout: null,
	settled_predictions: 0,
	prediction_hit_rate: null,
}

const locked = (over: Partial<LockedAchievement>): LockedAchievement => ({
	key: 'ten_wins',
	name: 'Ten Wins',
	description: 'Win 10 head-to-head bets.',
	progress: 4,
	target: 10,
	...over,
})

const dto = (over: Partial<UserAchievementsDto> = {}): UserAchievementsDto => ({
	user_id: 'u1',
	earned: [],
	locked: [],
	summary,
	...over,
})

describe('buildAchievementsView', () => {
	it('uses the approved label for a 3.16.0 server', () => {
		const view = buildAchievementsView(
			dto({
				earned: [
					{
						key: 'first_win',
						name: 'First Win',
						description: 'Win a head-to-head bet.',
						awarded_at: 'x',
					},
				],
				locked: [locked({ key: 'sharp_eye', name: 'Sharp Eye' })],
			}),
			none,
		)
		expect(view.earned[0]).toMatchObject({
			label: 'Opening Score',
			state: 'earned',
			gates: [],
		})
		expect(view.locked[0].label).toBe('The Line Reader')
		expect(view.total).toBe(2)
	})

	it('uses the server name when the server sends kind', () => {
		const view = buildAchievementsView(
			dto({
				locked: [
					locked({
						name: 'Renamed By Server',
						description: 'Server rule.',
						kind: 'career',
					}),
				],
			}),
			none,
		)
		expect(view.locked[0]).toMatchObject({
			label: 'Renamed By Server',
			criteria: 'Server rule.',
			kind: 'career',
		})
	})

	it('derives both gates of in_the_black from the summary', () => {
		const view = buildAchievementsView(
			dto({
				locked: [
					locked({ key: 'in_the_black', progress: 9, target: 10 }),
				],
				summary: { ...summary, settled_bets: 12, net_profit: -12.5 },
			}),
			none,
		)
		expect(view.locked[0].gates).toEqual([
			{ label: 'Settled head-to-head bets', text: '10/10', met: true },
			{
				label: 'Net head-to-head profit',
				text: '-$12.50, needs to be above $0.00',
				met: false,
			},
		])
	})

	it('derives both gates of sharp_eye and reports no predictions yet for a null rate', () => {
		const withRate = buildAchievementsView(
			dto({
				locked: [
					locked({ key: 'sharp_eye', progress: 14, target: 15 }),
				],
				summary: {
					...summary,
					settled_predictions: 25,
					prediction_hit_rate: 0.55,
				},
			}),
			none,
		)
		expect(withRate.locked[0].gates.map((g) => g.text)).toEqual([
			'15/15',
			'55.0% of 60%',
		])
		for (const [settled, text, met] of [
			[14, '14/15', false],
			[15, '15/15', true],
		] as const) {
			const gate = buildAchievementsView(
				dto({
					locked: [
						locked({ key: 'sharp_eye', progress: 14, target: 15 }),
					],
					summary: {
						...summary,
						settled_predictions: settled,
						prediction_hit_rate: 0.55,
					},
				}),
				none,
			).locked[0].gates[0]
			expect(gate).toMatchObject({ text, met })
		}
		const empty = buildAchievementsView(
			dto({ locked: [locked({ key: 'sharp_eye' })] }),
			none,
		)
		expect(empty.locked[0].gates[1]).toEqual({
			label: 'Prediction hit rate',
			text: 'no predictions yet',
			met: false,
		})
	})

	it('renders a compound gate as met count and unmet rate, never 19/20', () => {
		const view = buildAchievementsView(
			dto({
				locked: [
					locked({
						key: 'sharp_eye',
						progress: 14,
						target: 15,
						kind: 'form',
						gates: [
							{
								metric: 'settled_predictions',
								label: 'Settled predictions',
								unit: 'count',
								comparator: 'gte',
								target: 15,
								current: 20,
								met: true,
							},
							{
								metric: 'prediction_hit_rate',
								label: 'Prediction hit rate',
								unit: 'ratio',
								comparator: 'gte',
								target: 0.6,
								current: 0.55,
								met: false,
							},
						],
					}),
				],
			}),
			none,
		)
		const texts = view.locked[0].gates.map((g) => g.text)
		expect(texts).toEqual(['15/15', '55.0% of 60%'])
		expect(texts.join(' ')).not.toContain('14/15')
	})

	it('reads one gate from progress and target for a count badge', () => {
		const view = buildAchievementsView(
			dto({ locked: [locked({ key: 'ten_wins' })] }),
			none,
		)
		expect(view.locked[0].gates).toEqual([
			{ label: 'Head-to-head wins', text: '4/10', met: false },
		])
	})

	it("renders an unknown key with the server's name and no emoji", () => {
		const registry = buildBadgeEmojiRegistry([
			{ name: 'p_opening_score', id: ID },
		])
		const view = buildAchievementsView(
			dto({
				locked: [
					locked({
						key: 'future_badge',
						name: 'Future Badge',
						description: 'Do a thing.',
						progress: 1,
						target: 3,
					}),
				],
			}),
			registry,
		)
		expect(view.locked[0]).toMatchObject({
			label: 'Future Badge',
			criteria: 'Do a thing.',
			emoji: null,
			kind: 'career',
			gates: [{ label: 'Progress', text: '1/3', met: false }],
		})
	})

	it('resolves emoji from the registry by key', () => {
		const registry = buildBadgeEmojiRegistry([
			{ name: 'p_opening_score', id: ID },
		])
		const view = buildAchievementsView(
			dto({
				earned: [
					{
						key: 'first_win',
						name: 'First Win',
						description: '',
						awarded_at: 'x',
					},
				],
			}),
			registry,
		)
		expect(view.earned[0].emoji).toBe(`<:p_opening_score:${ID}>`)
	})
})

describe('formatGate', () => {
	const gate = (over: object) => ({
		metric: 'm',
		label: 'L',
		unit: 'count',
		comparator: 'gte',
		target: 10,
		current: 4,
		met: false,
		...over,
	})

	it('caps a count at its target', () => {
		expect(formatGate(gate({ current: 14, met: true })).text).toBe('10/10')
	})

	it('floors a ratio so an unmet rate never rounds up to the bar', () => {
		const text = (current: number) =>
			formatGate(gate({ unit: 'ratio', target: 0.6, current })).text
		expect(text(0.59996)).toBe('59.9% of 60%')
		expect(text(0.57)).toBe('57.0% of 60%')
	})

	it('formats currency with a strict comparator', () => {
		const text = (current: number, met: boolean) =>
			formatGate(
				gate({
					unit: 'currency',
					comparator: 'gt',
					target: 0,
					current,
					met,
				}),
			).text
		expect(text(-12.5, false)).toBe('-$12.50, needs to be above $0.00')
		expect(text(50, true)).toBe('$50.00')
	})

	it('treats an unknown unit as a count', () => {
		expect(formatGate(gate({ unit: 'weird' })).text).toBe('4/10')
	})

	it('says progress is not tracked when Khronos does not store the data yet', () => {
		expect(
			formatGate(gate({ tracked: false, current: null, met: false })),
		).toEqual({ label: 'L', met: false, text: 'progress not tracked yet' })
		expect(formatGate(gate({ tracked: true })).text).toBe('4/10')
	})

	it('shows a missing current value as no data yet', () => {
		expect(formatGate(gate({ unit: 'ratio', current: null })).text).toBe(
			'no predictions yet',
		)
	})
})

describe('catalogue shim', () => {
	it('mirrors the Khronos catalogue', () => {
		expect(
			Object.entries(BADGE_PRESENTATION).map(([key, b]) => [
				key,
				b.label,
				b.kind,
			]),
		).toEqual([
			['first_win', 'Opening Score', 'career'],
			['ten_wins', 'Double Figures', 'career'],
			['fifty_wins', 'Club Fifty', 'career'],
			['in_the_black', 'In the Black', 'form'],
			['sharp_eye', 'The Line Reader', 'form'],
			['prop_hunter', 'Player’s Edge', 'career'],
			['parlay_pro', 'All Legs Home', 'career'],
			['courtside', 'Courtside', 'career'],
			['due_a_win', 'Due a Win', 'career'],
			['trust_the_process', 'Trust the Process', 'career'],
			['match_point', 'Match Point', 'career'],
			['armchair_expert', 'Armchair Expert', 'career'],
			['extra_innings', 'Extra Innings', 'career'],
			['on_the_money', 'On the Money', 'career'],
			['bench_buddy', 'Bench Buddy', 'career'],
			['refs_fault', 'Ref’s Fault', 'career'],
			['statistically_fine', 'Statistically Fine', 'form'],
			['ice_in_the_veins', 'Ice in the Veins', 'career'],
			['hat_trick', 'Hat Trick', 'career'],
			['next_year_fc', 'Next Year FC', 'career'],
			['clean_sweep', 'Clean Sweep', 'career'],
			['long_shot', 'Long Shot', 'career'],
			['buzzer_beater', 'Buzzer Beater', 'career'],
			['one_leg_short', 'One Leg Short', 'career'],
			['reverse_jinx', 'Reverse Jinx', 'career'],
			['emotional_hedge', 'Emotional Hedge', 'career'],
			['underdog', 'Underdog', 'career'],
			['home_turf', 'Home Turf', 'career'],
			['photo_finish', 'Photo Finish', 'career'],
			['cashout_regret', 'Cashout Regret', 'career'],
		])
	})

	it('maps every key to an emoji name present in the manifest', () => {
		const manifest = JSON.parse(
			readFileSync(
				new URL(
					'../../../../scripts/badge-emoji/application-emoji-manifest.json',
					import.meta.url,
				),
				'utf8',
			),
		) as { entries: Array<{ badge_key: string; emoji_name: string }> }
		const byKey = new Map(
			manifest.entries.map((e) => [e.badge_key, e.emoji_name]),
		)
		for (const [key, badge] of Object.entries(BADGE_PRESENTATION))
			expect(byKey.get(key), key).toBe(badge.emojiName)
		expect(Object.keys(BADGE_PRESENTATION).sort()).toEqual(
			[...byKey.keys()].sort(),
		)
	})
})
