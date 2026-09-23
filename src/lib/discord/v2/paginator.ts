import { ButtonBuilder, type ButtonInteraction, ButtonStyle } from 'discord.js'
import {
	footer,
	text,
	V2_MAX_TEXT_CHARS,
	type V2Block,
	v2Payload,
} from './kit.js'

const NAMESPACE = 'pg'
const VERSION = 'v1'
const SCOPE_RE = /^[a-z0-9-]{1,32}$/
const PAGE_RE = /^(0|[1-9]\d*)$/
const ACTIONS = ['first', 'prev', 'next', 'last'] as const

export type PageNavAction = (typeof ACTIONS)[number]
export type PageNav = { scope: string; page: number; action: PageNavAction }

/** `pg.v1.<scope>.<page>.<action>`, where page is the page the button navigates TO. */
export function encodePageNav({ scope, page, action }: PageNav): string {
	if (!SCOPE_RE.test(scope)) throw new Error(`invalid page scope: ${scope}`)
	if (!Number.isSafeInteger(page) || page < 0)
		throw new Error(`invalid page: ${page}`)
	const id = `${NAMESPACE}.${VERSION}.${scope}.${page}.${action}`
	if (id.length > 100) throw new Error('page nav custom ID exceeds 100 chars')
	return id
}

export function decodePageNav(customId: string): PageNav | null {
	const parts = customId.split('.')
	if (parts.length !== 5) return null
	const [ns, version, scope, pageStr, action] = parts
	if (ns !== NAMESPACE || version !== VERSION) return null
	if (!SCOPE_RE.test(scope) || !PAGE_RE.test(pageStr)) return null
	if (!(ACTIONS as readonly string[]).includes(action)) return null
	const page = Number(pageStr)
	if (!Number.isSafeInteger(page)) return null
	return { scope, page, action: action as PageNavAction }
}

export type RenderPageOptions = {
	scope: string
	title: string
	lines: string[]
	page: number
	perPage: number
	accent?: number
	footerText?: string
	ephemeral?: boolean
}

const NAV_LABELS: Record<PageNavAction, string> = {
	first: '«',
	prev: '‹',
	next: '›',
	last: '»',
}

/** Stateless render of one page; the whole message is rebuilt on every nav. */
export function renderPage(opts: RenderPageOptions) {
	const { scope, title, lines, perPage } = opts
	const heading = `## ${title}`
	const blocks: V2Block[] = [text(heading)]

	if (lines.length === 0) {
		blocks.push(text('Nothing to show yet.'))
		if (opts.footerText) blocks.push(footer(opts.footerText))
		return v2Payload({
			blocks,
			accent: opts.accent,
			ephemeral: opts.ephemeral,
		})
	}

	const size = Math.max(1, Math.floor(perPage))
	const pages = Math.ceil(lines.length / size)
	const page = Math.min(Math.max(0, Math.floor(opts.page) || 0), pages - 1)
	const last = pages - 1

	const pageLabel = `Page ${page + 1}/${pages}`
	const footText = opts.footerText
		? `${opts.footerText} · ${pageLabel}`
		: pageLabel
	const foot = footer(footText)
	// One TextDisplay for the whole page: one-per-line would blow the 40-component cap.
	// Clamp here: TextDisplayBuilder throws past 4000 chars before v2Payload can clamp,
	// and reserving title/footer room keeps "Page X/Y" visible.
	const budget = V2_MAX_TEXT_CHARS - heading.length - `-# ${footText}`.length
	let body = lines.slice(page * size, (page + 1) * size).join('\n')
	if (body.length > budget) body = `${body.slice(0, budget - 1)}…`
	blocks.push(text(body), foot)

	const targets: Record<PageNavAction, number> = {
		first: 0,
		prev: Math.max(0, page - 1),
		next: Math.min(last, page + 1),
		last,
	}
	const nav = ACTIONS.map((action) =>
		new ButtonBuilder()
			.setCustomId(
				encodePageNav({ scope, page: targets[action], action }),
			)
			.setLabel(NAV_LABELS[action])
			.setStyle(ButtonStyle.Secondary)
			.setDisabled(
				action === 'first' || action === 'prev'
					? page === 0
					: page === last,
			),
	)

	return v2Payload({
		blocks,
		accent: opts.accent,
		ephemeral: opts.ephemeral,
		actions: pages > 1 ? [nav] : undefined,
	})
}

export type PageSource = {
	load(
		interaction: ButtonInteraction,
		page: number,
	): Promise<RenderPageOptions>
	ownerOnly?: boolean
}

const sources = new Map<string, PageSource>()

export function registerPageSource(scope: string, source: PageSource) {
	if (!SCOPE_RE.test(scope)) throw new Error(`invalid page scope: ${scope}`)
	sources.set(scope, source)
}

export function getPageSource(scope: string): PageSource | undefined {
	return sources.get(scope)
}
