import {
	ButtonBuilder,
	ButtonStyle,
	escapeMarkdown,
	StringSelectMenuBuilder,
	StringSelectMenuOptionBuilder,
} from 'discord.js'
import type { AchievementsView, BadgeView } from '../../badges/badge-view.js'
import {
	collapsedAchievementCount,
	PROFILE_VIEW_LABELS,
	PROFILE_VIEWS,
	type ProfileView,
	SHELF_PAGE_SIZE,
	shelfPageCount,
} from '../../profile/profile-view.js'
import {
	accent,
	divider,
	footer,
	section,
	text,
	thumbnail,
	v2Payload,
} from '../v2/kit.js'
import { encodeProfileViewAction } from './profile-view-ids.js'

export interface ProfileStats {
	wins: number
	losses: number
	pushes: number
	netProfit: number
}

/** Everything a profile view draws, already loaded. Null means unavailable. */
export interface ProfileViewModel {
	userId: string
	displayName: string
	avatarUrl: string | null
	balance: number | null
	level: number | null
	tier: string | null
	stats: ProfileStats | null
	achievements: AchievementsView | null
}

export interface ProfileViewRoute {
	/** The invoker; only this user may drive the message. */
	ownerId: string
}

export interface ProfileViewOptions {
	view: ProfileView
	model: ProfileViewModel
	route: ProfileViewRoute
	/** Show every achievement instead of the latest few. */
	expanded?: boolean
	/** Trophy Shelf page while expanded. */
	page?: number
	/** The Share button is spent. */
	shared?: boolean
	/** Set for the public copy: no controls, and the sharer is named. */
	sharerId?: string
}

/** Leaves room under the 4,000 V2 text limit for the other blocks. */
const LIST_TEXT_BUDGET = 2600

const usd = new Intl.NumberFormat('en-US', {
	style: 'currency',
	currency: 'USD',
})
const money = (n: number) => usd.format(n)
const signed = (n: number) =>
	n > 0 ? `+${usd.format(n)}` : n < 0 ? `−${usd.format(-n)}` : usd.format(0)

const record = (s: ProfileStats) =>
	`${s.wins}–${s.losses}${s.pushes ? `–${s.pushes}` : ''}`

const winRate = (s: ProfileStats) => {
	const decided = s.wins + s.losses
	return decided ? `${((s.wins / decided) * 100).toFixed(1)}%` : null
}

const levelLine = (m: ProfileViewModel, word: string) =>
	m.level === null
		? null
		: `Level ${m.level}${m.tier ? `, ${m.tier}${word}` : ''}`

const earnedOn = (badge: BadgeView) => {
	const ms = badge.awardedAt ? Date.parse(badge.awardedAt) : Number.NaN
	return Number.isNaN(ms) ? null : `<t:${Math.floor(ms / 1000)}:D>`
}

const lead = (badge: BadgeView) => (badge.emoji ? `${badge.emoji} ` : '')

const progress = (badge: BadgeView) =>
	badge.gates.map((g) => `${g.label} ${g.text}`).join(' · ')

const button = (label: string, customId: string, disabled = false) =>
	new ButtonBuilder()
		.setCustomId(customId)
		.setLabel(label)
		.setStyle(ButtonStyle.Secondary)
		.setDisabled(disabled)

function controls(o: ProfileViewOptions, expand: ButtonBuilder | null) {
	const { ownerId } = o.route
	const targetId = o.model.userId
	const row: ButtonBuilder[] = []
	if (expand) row.push(expand)
	row.push(
		button(
			o.shared ? 'Shared' : 'Share to channel',
			encodeProfileViewAction({ kind: 'share', ownerId, targetId }),
			Boolean(o.shared),
		),
	)
	if (ownerId === targetId)
		row.push(
			button(
				'Settings',
				encodeProfileViewAction({ kind: 'settings', ownerId }),
			),
		)
	return row
}

const expandButton = (o: ProfileViewOptions, label: string) =>
	button(
		label,
		encodeProfileViewAction({
			kind: 'expand',
			ownerId: o.route.ownerId,
			targetId: o.model.userId,
			page: 0,
		}),
	)

const collapseButton = (o: ProfileViewOptions) =>
	button(
		'Show less',
		encodeProfileViewAction({
			kind: 'collapse',
			ownerId: o.route.ownerId,
			targetId: o.model.userId,
		}),
	)

const countLine = (a: AchievementsView) =>
	`-# ${a.earned.length} of ${a.total} earned`

function header(
	lines: string[],
	model: ProfileViewModel,
): ReturnType<typeof text> | ReturnType<typeof section> {
	return model.avatarUrl
		? section(lines, thumbnail(model.avatarUrl))
		: text(lines.join('\n'))
}

function headlineHeader(m: ProfileViewModel) {
	const facts = m.stats
		? [
				`**${record(m.stats)}** record`,
				winRate(m.stats) ? `**${winRate(m.stats)}** win rate` : null,
				`**${signed(m.stats.netProfit)}** net`,
			]
				.filter(Boolean)
				.join(',  ')
		: null
	const top = [escapeMarkdown(m.displayName), levelLine(m, '')]
		.filter(Boolean)
		.join('  ·  ')
	return header(
		[
			`-# ${top}`,
			m.balance === null
				? '# Balance unavailable'
				: `# ${money(m.balance)}`,
			...(facts ? [facts] : []),
		],
		m,
	)
}

/** Earned lines first, then what is still open, shrinking to fit the text limit. */
function headlineList(a: AchievementsView) {
	const earnedLine = (b: BadgeView, full: boolean) => {
		const date = earnedOn(b)
		const head = `${lead(b)}**${b.label}**${date ? `  ${date}` : ''}`
		return full ? `${head}\n-# ${b.criteria}` : head
	}
	const openLine = (b: BadgeView, full: boolean) => {
		const head = `**${b.label}**${progress(b) ? `  ${progress(b)}` : ''}`
		return full ? `${head}\n-# ${b.criteria}` : head
	}
	const build = (full: boolean) => ({
		earned: a.earned.map((b) => earnedLine(b, full)).join('\n'),
		open: a.locked.map((b) => openLine(b, full)).join('\n'),
	})
	let lists = build(true)
	if (lists.earned.length + lists.open.length > LIST_TEXT_BUDGET)
		lists = build(false)
	return lists
}

function headlineAchievements(o: ProfileViewOptions) {
	const { achievements: a } = o.model
	if (!a)
		return {
			blocks: [text('### Achievements\n-# Unavailable right now.')],
			row: null,
		}
	const toggle = o.sharerId
		? null
		: o.expanded
			? collapseButton(o)
			: a.total
				? expandButton(o, 'Show all')
				: null
	const heading = [text('### Achievements'), text(countLine(a))]
	const head = toggle
		? section(['### Achievements', countLine(a)], toggle)
		: null
	const top = head ? [head] : heading
	if (o.expanded) {
		const lists = headlineList(a)
		return {
			blocks: [
				...top,
				...(lists.earned ? [text(lists.earned)] : []),
				...(lists.open
					? [divider(), text(`### Not earned yet\n${lists.open}`)]
					: []),
			],
			row: null,
		}
	}
	const shown = a.earned.slice(0, collapsedAchievementCount(a.earned.length))
	const next = a.locked[0]
	const body = shown.length
		? shown
				.map((b) => {
					const date = earnedOn(b)
					return `${lead(b)}**${b.label}**${date ? `  ${date}` : ''}`
				})
				.join('\n')
		: next
			? `-# None yet. First up is **${next.label}**. ${next.criteria}`
			: '-# None yet.'
	return { blocks: [...top, text(body)], row: null }
}

const sharedFooter = (o: ProfileViewOptions) =>
	o.sharerId ? [footer(`Shared by <@${o.sharerId}>`)] : []

function headline(o: ProfileViewOptions) {
	const m = o.model
	const ach = headlineAchievements(o)
	return v2Payload({
		accent: accent('PlutoBlue'),
		blocks: [
			headlineHeader(m),
			divider(),
			...ach.blocks,
			...sharedFooter(o),
		],
		actions: o.expanded || o.sharerId ? [] : [controls(o, null)],
	})
}

function shelfItem(b: BadgeView) {
	const status = b.state === 'earned' ? earnedOn(b) : null
	const note =
		b.state === 'earned'
			? status
				? `-# Earned ${status}`
				: '-# Earned'
			: `-# Not earned yet${progress(b) ? `  ·  ${progress(b)}` : ''}`
	const lines = [`**${b.label}**`, b.criteria, note]
	return b.art ? section(lines, thumbnail(b.art)) : text(lines.join('\n'))
}

function shelfHeader(m: ProfileViewModel) {
	const parts = [
		m.balance === null ? null : `**${money(m.balance)}** balance`,
		m.stats ? `**${record(m.stats)}** record` : null,
		m.stats ? `**${signed(m.stats.netProfit)}** net` : null,
	].filter(Boolean)
	const level = levelLine(m, ' tier')
	return header(
		[
			`## ${escapeMarkdown(m.displayName)}`,
			...(parts.length ? [parts.join('  ·  ')] : []),
			...(level ? [`-# ${level}`] : []),
		],
		m,
	)
}

function shelf(o: ProfileViewOptions) {
	const m = o.model
	const a = m.achievements
	if (!a) {
		return v2Payload({
			accent: accent('PlutoBlue'),
			blocks: [
				shelfHeader(m),
				divider(),
				text('### Achievements\n-# Unavailable right now.'),
				...sharedFooter(o),
			],
			actions: o.sharerId ? [] : [controls(o, null)],
		})
	}

	if (o.expanded) {
		const all = [...a.earned, ...a.locked]
		const pages = shelfPageCount(all.length)
		const page = Math.min(Math.max(o.page ?? 0, 0), pages - 1)
		const slice = all.slice(
			page * SHELF_PAGE_SIZE,
			page * SHELF_PAGE_SIZE + SHELF_PAGE_SIZE,
		)
		const step = (to: number) =>
			encodeProfileViewAction({
				kind: 'expand',
				ownerId: o.route.ownerId,
				targetId: m.userId,
				page: to,
			})
		return v2Payload({
			accent: accent('PlutoBlue'),
			blocks: [
				text(
					`## Achievements\n-# ${escapeMarkdown(m.displayName)}  ·  ${a.earned.length} of ${a.total} earned`,
				),
				divider(),
				...slice.map(shelfItem),
				divider(),
				...(pages > 1 ? [footer(`Page ${page + 1} of ${pages}`)] : []),
			],
			actions: [
				[
					...(pages > 1
						? [
								button(
									'Previous',
									step(Math.max(page - 1, 0)),
									page === 0,
								),
								button(
									'Next',
									step(Math.min(page + 1, pages - 1)),
									page >= pages - 1,
								),
							]
						: []),
					collapseButton(o),
				],
			],
		})
	}

	const shown = a.earned.slice(0, collapsedAchievementCount(a.earned.length))
	const first = shown.length ? null : a.locked[0]
	const items = shown.length ? shown : first ? [first] : []
	const heading = shown.length
		? '### Latest achievements'
		: o.route.ownerId === o.model.userId
			? '### Your first achievement'
			: '### First achievement to earn'
	const label =
		a.earned.length > shown.length
			? `Show all ${a.earned.length}`
			: 'Show all achievements'
	return v2Payload({
		accent: accent('PlutoBlue'),
		blocks: [
			shelfHeader(m),
			divider(),
			text(heading),
			...(items.length ? items.map(shelfItem) : [text('-# None yet.')]),
			divider(),
			text(countLine(a)),
			...sharedFooter(o),
		],
		actions: o.sharerId
			? []
			: [controls(o, a.total ? expandButton(o, label) : null)],
	})
}

/** Ephemeral card for /profile. Expanded states drop Share; Show less returns to it. */
export function profileViewPayload(opts: ProfileViewOptions) {
	return opts.view === 'trophy_shelf' ? shelf(opts) : headline(opts)
}

/** Public post made by Share: the collapsed view, no controls, sharer named. */
export function profileSharedViewPayload(
	opts: Omit<ProfileViewOptions, 'expanded' | 'page' | 'shared' | 'sharerId'>,
	sharerId: string,
) {
	return profileViewPayload({ ...opts, expanded: false, sharerId })
}

export function profileSettingsPayload(opts: {
	ownerId: string
	current: ProfileView
	saved?: boolean
	ephemeral?: boolean
}) {
	const describe: Record<ProfileView, string> = {
		headline: 'Balance first, then your latest achievements',
		trophy_shelf: 'Badge art, with how to earn each one',
	}
	const select = new StringSelectMenuBuilder()
		.setCustomId(
			encodeProfileViewAction({ kind: 'setview', ownerId: opts.ownerId }),
		)
		.setPlaceholder('Default profile view')
		.addOptions(
			PROFILE_VIEWS.map((view) =>
				new StringSelectMenuOptionBuilder()
					.setLabel(PROFILE_VIEW_LABELS[view])
					.setValue(view)
					.setDescription(describe[view])
					.setDefault(view === opts.current),
			),
		)
	return v2Payload({
		accent: accent('PlutoBlue'),
		blocks: [
			text('## Profile settings'),
			text(
				'Pick how your profile looks. Everyone who opens it sees this view.',
			),
			text(
				opts.saved
					? `-# Saved. Your default is ${PROFILE_VIEW_LABELS[opts.current]}.`
					: `-# Your default is ${PROFILE_VIEW_LABELS[opts.current]}.`,
			),
		],
		actions: [[select]],
		ephemeral: opts.ephemeral,
	})
}
