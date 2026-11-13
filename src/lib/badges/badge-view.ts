import type {
	AchievementGate,
	AchievementSummary,
	EarnedAchievement,
	LockedAchievement,
	UserAchievementsDto,
} from '../../utils/api/Khronos/achievements/achievements-wrapper.js'
import type { BadgeEmojiRegistry } from './badge-emoji-registry.js'
import { BADGE_PRESENTATION, type BadgeKind } from './badge-presentation.js'

export interface GateView {
	label: string
	text: string
	met: boolean
}

export interface BadgeView {
	key: string
	label: string
	criteria: string
	kind: BadgeKind
	state: 'earned' | 'locked'
	emoji: string | null
	/** Emoji image URL, or null when the emoji is not uploaded. */
	art: string | null
	/** ISO time the badge was earned; null for a locked badge. */
	awardedAt: string | null
	gates: GateView[]
}

export interface AchievementsView {
	earned: BadgeView[]
	locked: BadgeView[]
	total: number
}

const NO_PREDICTIONS = 'no predictions yet'
export const NOT_TRACKED = 'progress not tracked yet'

const money = (value: number) =>
	`${value < 0 ? '-' : ''}$${Math.abs(value).toFixed(2)}`

/** Floored to one decimal, so an unmet 59.996% never shows as 60.0%. */
const percent = (ratio: number) =>
	`${(Math.floor(ratio * 1000 + 1e-9) / 10).toFixed(1)}%`

const percentTarget = (ratio: number) => `${Number((ratio * 100).toFixed(1))}%`

export function formatGate(gate: AchievementGate): GateView {
	const { label, met, current, target } = gate
	if (gate.tracked === false) return { label, met: false, text: NOT_TRACKED }
	if (gate.unit === 'ratio') {
		return {
			label,
			met,
			text:
				current === null
					? NO_PREDICTIONS
					: `${percent(current)} of ${percentTarget(target)}`,
		}
	}
	if (gate.unit === 'currency') {
		const value = money(current ?? 0)
		return {
			label,
			met,
			text:
				met || gate.comparator !== 'gt'
					? value
					: `${value}, needs to be above ${money(target)}`,
		}
	}
	return {
		label,
		met,
		text: `${Math.min(current ?? 0, target)}/${target}`,
	}
}

const count = (label: string, current: number, target: number): GateView => ({
	label,
	text: `${Math.min(current, target)}/${target}`,
	met: current >= target,
})

function legacyGates(
	entry: LockedAchievement,
	summary: AchievementSummary,
): GateView[] {
	if (entry.key === 'in_the_black') {
		return [
			count('Settled head-to-head bets', summary.settled_bets, 10),
			formatGate({
				metric: 'net_profit',
				label: 'Net head-to-head profit',
				unit: 'currency',
				comparator: 'gt',
				target: 0,
				current: summary.net_profit,
				met: summary.net_profit > 0,
			}),
		]
	}
	if (entry.key === 'sharp_eye') {
		const rate = summary.prediction_hit_rate
		return [
			count('Settled predictions', summary.settled_predictions, 20),
			formatGate({
				metric: 'prediction_hit_rate',
				label: 'Prediction hit rate',
				unit: 'ratio',
				comparator: 'gte',
				target: 0.6,
				current: rate,
				met: rate !== null && rate >= 0.6,
			}),
		]
	}
	const label = BADGE_PRESENTATION[entry.key]?.progressLabel ?? 'Progress'
	return [count(label, entry.progress, entry.target)]
}

function toView(
	entry: EarnedAchievement | LockedAchievement,
	state: BadgeView['state'],
	registry: BadgeEmojiRegistry,
	gates: GateView[],
): BadgeView {
	const shim = BADGE_PRESENTATION[entry.key]
	const serverOwnsText = entry.kind !== undefined
	return {
		key: entry.key,
		label: serverOwnsText ? entry.name : (shim?.label ?? entry.name),
		criteria: serverOwnsText
			? entry.description
			: (shim?.criteria ?? entry.description),
		kind: entry.kind ?? shim?.kind ?? 'career',
		state,
		emoji: shim ? registry.format(shim.emojiName) : null,
		art: shim ? registry.url(shim.emojiName) : null,
		awardedAt: 'awarded_at' in entry ? entry.awarded_at : null,
		gates,
	}
}

export function buildAchievementsView(
	dto: UserAchievementsDto,
	registry: BadgeEmojiRegistry,
): AchievementsView {
	const earned = dto.earned.map((entry) =>
		toView(entry, 'earned', registry, []),
	)
	const locked = dto.locked.map((entry) =>
		toView(
			entry,
			'locked',
			registry,
			entry.gates
				? entry.gates.map(formatGate)
				: legacyGates(entry, dto.summary),
		),
	)
	return { earned, locked, total: earned.length + locked.length }
}
