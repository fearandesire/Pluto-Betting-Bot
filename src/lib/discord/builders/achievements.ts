import { escapeMarkdown } from 'discord.js'
import type { AchievementsView, BadgeView } from '../../badges/badge-view.js'
import { footer, text, v2Payload } from '../v2/kit.js'

const VIEW_PREFIX = 'ach.v1.view'
const SNOWFLAKE = /^\d{17,20}$/

/** Above this the full text switches to compact lines, leaving room under the 4,000 V2 limit. */
const FULL_TEXT_BUDGET = 3600
const FORM_NOTE = 'Held while you meet the bar.'

export function encodeAchievementsView(targetId: string): string {
	if (!SNOWFLAKE.test(targetId)) throw new Error('invalid achievements id')
	return `${VIEW_PREFIX}.${targetId}`
}

export function decodeAchievementsView(customId: string): string | null {
	const parts = customId.split('.')
	if (parts.length !== 4) return null
	if (`${parts[0]}.${parts[1]}.${parts[2]}` !== VIEW_PREFIX) return null
	return SNOWFLAKE.test(parts[3]) ? parts[3] : null
}

const lead = (badge: BadgeView) => (badge.emoji ? `${badge.emoji} ` : '')

const gateText = (badge: BadgeView) =>
	badge.gates
		.map((g) => `${g.label} ${g.text}${g.met ? ' (done)' : ''}`)
		.join(' · ')

function fullLines(badges: BadgeView[]): string[] {
	return badges.flatMap((badge) => {
		const note =
			badge.state === 'earned' && badge.kind === 'form'
				? ` ${FORM_NOTE}`
				: ''
		const line = `${lead(badge)}**${badge.label}**: ${badge.criteria}${note}`
		return badge.gates.length ? [line, `-# ${gateText(badge)}`] : [line]
	})
}

function compactLines(badges: BadgeView[]): string[] {
	return badges.map((badge) =>
		badge.gates.length
			? `${lead(badge)}**${badge.label}** · ${gateText(badge)}`
			: `${lead(badge)}**${badge.label}**`,
	)
}

function sections(view: AchievementsView, compact: boolean) {
	const lines = compact ? compactLines : fullLines
	return {
		earned: `**Earned**\n${view.earned.length ? lines(view.earned).join('\n') : 'None yet.'}`,
		locked: `**Still to earn**\n${view.locked.length ? lines(view.locked).join('\n') : 'All earned.'}`,
	}
}

export function achievementsPayload(
	view: AchievementsView,
	displayName: string,
) {
	const heading = `## Achievements: ${escapeMarkdown(displayName)}\n-# ${view.earned.length} of ${view.total} badges earned`
	const footnote =
		'Badges are cosmetic. Pluto checks them when a profile or this list is opened.'
	let { earned, locked } = sections(view, false)
	if (
		heading.length + earned.length + locked.length + footnote.length >
		FULL_TEXT_BUDGET
	)
		({ earned, locked } = sections(view, true))
	return v2Payload({
		blocks: [text(heading), text(earned), text(locked), footer(footnote)],
	})
}

export function profileBadgeLine(view: AchievementsView, limit: number) {
	const leading = view.earned
		.slice(0, limit)
		.map((badge) => `${lead(badge)}${badge.label}`)
	return [...leading, `${view.earned.length} of ${view.total} badges`].join(
		' · ',
	)
}
