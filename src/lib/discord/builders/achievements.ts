import { ButtonBuilder, ButtonStyle, escapeMarkdown } from 'discord.js'
import type { AchievementsView, BadgeView } from '../../badges/badge-view.js'
import { footer, text, v2Payload } from '../v2/kit.js'

const VIEW_PREFIX = 'ach.v1.view'
const SNOWFLAKE = /^\d{17,20}$/
const PAGE = /^\d{1,3}$/

/** Page text stays under this, leaving room under the 4,000 V2 limit. */
const PAGE_TEXT_BUDGET = 3600
/** Room for the page note, empty-section placeholders and joins. */
const PAGE_RESERVE = 80
const FORM_NOTE = 'You keep it only while you still qualify.'
const EARNED_HEADER = '**Earned**'
const LOCKED_HEADER = '**Still to earn**'

export function encodeAchievementsView(targetId: string): string {
	if (!SNOWFLAKE.test(targetId)) throw new Error('invalid achievements id')
	return `${VIEW_PREFIX}.${targetId}`
}

/** The Previous and Next buttons on a list that spans pages. */
export function encodeAchievementsPage(targetId: string, page: number): string {
	if (!SNOWFLAKE.test(targetId)) throw new Error('invalid achievements id')
	if (!Number.isInteger(page) || page < 0 || page > 999)
		throw new Error('invalid achievements page')
	return `${VIEW_PREFIX}.${targetId}.${page}`
}

/** The profile's Achievements button: opens the list at its first page. */
export function decodeAchievementsView(customId: string): string | null {
	const parts = customId.split('.')
	if (parts.length !== 4) return null
	if (`${parts[0]}.${parts[1]}.${parts[2]}` !== VIEW_PREFIX) return null
	return SNOWFLAKE.test(parts[3]) ? parts[3] : null
}

export function decodeAchievementsPage(
	customId: string,
): { targetId: string; page: number } | null {
	const parts = customId.split('.')
	if (parts.length !== 5) return null
	if (`${parts[0]}.${parts[1]}.${parts[2]}` !== VIEW_PREFIX) return null
	if (!SNOWFLAKE.test(parts[3]) || !PAGE.test(parts[4])) return null
	return { targetId: parts[3], page: Number(parts[4]) }
}

const lead = (badge: BadgeView) => (badge.emoji ? `${badge.emoji} ` : '')

const gateText = (badge: BadgeView) =>
	badge.gates
		.map((g) => `${g.label} ${g.text}${g.met ? ' (done)' : ''}`)
		.join(' · ')

function badgeLines(badge: BadgeView): string[] {
	const note =
		badge.state === 'earned' && badge.kind === 'form' ? ` ${FORM_NOTE}` : ''
	const line = `${lead(badge)}**${badge.label}**: ${badge.criteria}${note}`
	return badge.gates.length ? [line, `-# ${gateText(badge)}`] : [line]
}

interface Entry {
	section: 'earned' | 'locked'
	text: string
}

interface Page {
	earned: string[]
	locked: string[]
}

/**
 * Greedy split into pages that each fit the text budget with every rule,
 * progress line and form note intact. Nothing is shortened to fit.
 */
function paginate(view: AchievementsView, fixedChars: number): Page[] {
	const entries: Entry[] = [
		...view.earned.map((b) => ({
			section: 'earned' as const,
			text: badgeLines(b).join('\n'),
		})),
		...view.locked.map((b) => ({
			section: 'locked' as const,
			text: badgeLines(b).join('\n'),
		})),
	]
	const pages: Page[] = []
	let page: Page = { earned: [], locked: [] }
	let used = fixedChars + PAGE_RESERVE
	for (const entry of entries) {
		const header =
			entry.section === 'earned' ? EARNED_HEADER : LOCKED_HEADER
		const opensSection = page[entry.section].length === 0
		const cost =
			entry.text.length + 1 + (opensSection ? header.length + 1 : 0)
		const isEmpty = page.earned.length + page.locked.length === 0
		if (!isEmpty && used + cost > PAGE_TEXT_BUDGET) {
			pages.push(page)
			page = { earned: [], locked: [] }
			used = fixedChars + PAGE_RESERVE
			used += entry.text.length + 1 + header.length + 1
		} else {
			used += cost
		}
		page[entry.section].push(entry.text)
	}
	pages.push(page)
	return pages
}

export function achievementsPageCount(
	view: AchievementsView,
	displayName: string,
): number {
	return paginate(view, fixedChars(view, displayName)).length
}

const FOOTNOTE =
	'Badges are just for show. Pluto updates them when you open a profile or this list.'

const headingFor = (view: AchievementsView, displayName: string) =>
	`## Achievements: ${escapeMarkdown(displayName)}\n-# ${view.earned.length} of ${view.total} badges earned`

const fixedChars = (view: AchievementsView, displayName: string) =>
	headingFor(view, displayName).length + FOOTNOTE.length

const button = (label: string, customId: string, disabled: boolean) =>
	new ButtonBuilder()
		.setCustomId(customId)
		.setLabel(label)
		.setStyle(ButtonStyle.Secondary)
		.setDisabled(disabled)

/**
 * One page of the list. A list that fits shows no buttons; a longer one is
 * split into pages with Previous and Next, and every page keeps its rules.
 */
export function achievementsPayload(
	view: AchievementsView,
	displayName: string,
	nav?: { targetId: string; page?: number },
) {
	const pages = paginate(view, fixedChars(view, displayName))
	const index = Math.min(Math.max(nav?.page ?? 0, 0), pages.length - 1)
	const current = pages[index]
	const multi = pages.length > 1
	const heading = `${headingFor(view, displayName)}${multi ? ` · Page ${index + 1} of ${pages.length}` : ''}`
	const earned = current.earned.length
		? current.earned.join('\n')
		: multi
			? ''
			: 'None yet.'
	const locked = current.locked.length
		? current.locked.join('\n')
		: multi
			? ''
			: 'All earned.'
	const blocks = [text(heading)]
	if (earned) blocks.push(text(`${EARNED_HEADER}\n${earned}`))
	if (locked) blocks.push(text(`${LOCKED_HEADER}\n${locked}`))
	blocks.push(footer(FOOTNOTE))
	return v2Payload({
		blocks,
		actions:
			multi && nav
				? [
						[
							button(
								'Previous',
								encodeAchievementsPage(
									nav.targetId,
									Math.max(index - 1, 0),
								),
								index === 0,
							),
							button(
								'Next',
								encodeAchievementsPage(
									nav.targetId,
									Math.min(index + 1, pages.length - 1),
								),
								index >= pages.length - 1,
							),
						],
					]
				: undefined,
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
