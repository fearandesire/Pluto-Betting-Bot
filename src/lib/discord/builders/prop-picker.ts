import type { PostPropsResponseDto } from '@pluto-khronos/api-client'
import {
	ButtonBuilder,
	ButtonStyle,
	type MessageActionRowComponentBuilder,
	StringSelectMenuBuilder,
} from 'discord.js'
import { MarketKeyTranslations } from '../../../utils/api/common/interfaces/market-translations.js'
import StringUtils from '../../../utils/common/string-utils.js'
import {
	PROP_PICKER_MAX_SELECTED,
	type PropPickerPage,
	paginatePropPickerPairs,
	selectedPropPickerPairs,
} from '../../../utils/props/PropPicker.js'
import type { PropPickerSession } from '../../../utils/props/PropPickerStore.js'
import { footer, text, v2Payload } from '../v2/kit.js'

const PREFIX = 'props.pick.v1'
const TOKEN_RE = /^[a-f0-9]{16}$/

export const PROP_PICKER_ACTIONS = [
	'select',
	'prev',
	'next',
	'clear',
	'preview',
	'post',
] as const

export type PropPickerAction = (typeof PROP_PICKER_ACTIONS)[number]

export function encodePropPickerId(
	token: string,
	action: PropPickerAction,
): string {
	if (!TOKEN_RE.test(token)) throw new Error(`invalid picker token: ${token}`)
	return `${PREFIX}.${action}.${token}`
}

export function decodePropPickerId(
	customId: string,
): { action: PropPickerAction; token: string } | null {
	const parts = customId.split('.')
	if (parts.length !== 5) return null
	const [namespace, group, version, action, token] = parts
	if (`${namespace}.${group}.${version}` !== PREFIX) return null
	if (!(PROP_PICKER_ACTIONS as readonly string[]).includes(action)) {
		return null
	}
	if (!TOKEN_RE.test(token)) return null
	return { action: action as PropPickerAction, token }
}

function marketName(marketKey: string): string {
	return StringUtils.toTitleCase(
		MarketKeyTranslations[
			marketKey as keyof typeof MarketKeyTranslations
		] || marketKey,
	)
}

function formatPrice(price: number): string {
	return `${price > 0 ? '+' : ''}${price}`
}

function currentPrice(
	session: PropPickerSession,
	pair: PropPickerSession['pairs'][number],
): { over: number; under: number } {
	return (
		session.prices[pair.key] ?? {
			over: pair.overPrice,
			under: pair.underPrice,
		}
	)
}

function pairLine(
	session: PropPickerSession,
	index: number,
	pair: PropPickerSession['pairs'][number],
): string {
	const price = currentPrice(session, pair)
	const point =
		pair.line === null || pair.line === undefined ? '' : ` \`${pair.line}\``
	return `${index + 1}. **${pair.player ?? 'Prop'}** · ${marketName(pair.marketKey)}${point} — Over ${formatPrice(price.over)} / Under ${formatPrice(price.under)}`
}

/**
 * One picker page: a private select menu for this page's 25 pairs, page
 * controls and the Post action. Every render rebuilds the whole container so
 * selections made on other pages stay visible in the counter.
 */
export function propPickerPayload(
	session: PropPickerSession,
	warning?: string,
): ReturnType<typeof v2Payload> {
	const pageData = paginatePropPickerPairs(session.pairs, session.page)
	const selected = new Set(session.selected)
	const blocks = [
		text('## Pick props'),
		text(
			[
				`Game: ${session.filters.game || 'all'} · Category: ${session.filters.category || 'all'} · Player: ${session.filters.player || 'any'}`,
				`Selected ${session.selected.length} of ${PROP_PICKER_MAX_SELECTED}. Selections stay put when you change page.`,
			].join('\n'),
		),
	]
	if (warning) blocks.push(text(`> ${warning}`))
	if (pageData.items.length === 0) {
		blocks.push(
			text(
				'No props match these filters. Run the command again with different filters.',
			),
		)
	} else {
		blocks.push(
			text(
				pageData.items
					.map((pair, index) => pairLine(session, index, pair))
					.join('\n'),
			),
		)
	}
	blocks.push(
		footer(
			`Page ${pageData.page + 1}/${pageData.pages} · ${pageData.total} props · prices are re-checked on Post`,
		),
	)

	const actions: MessageActionRowComponentBuilder[][] = []
	if (pageData.items.length > 0) {
		actions.push([selectMenu(session, pageData, selected)])
	}
	actions.push(buttonRow(session, pageData, selected))
	return v2Payload({ blocks, actions })
}

function selectMenu(
	session: PropPickerSession,
	pageData: PropPickerPage,
	selected: ReadonlySet<string>,
): StringSelectMenuBuilder {
	const menu = new StringSelectMenuBuilder()
		.setCustomId(encodePropPickerId(session.token, 'select'))
		.setPlaceholder('Select props on this page')
		.setMinValues(0)
		.setMaxValues(Math.min(pageData.items.length, 25))
	return menu.addOptions(
		pageData.items.map((pair, index) => ({
			label: `${index + 1}. ${pair.player ?? 'Prop'} · ${marketName(pair.marketKey)}${pair.line === null ? '' : ` ${pair.line}`}`.slice(
				0,
				100,
			),
			description: describePrice(currentPrice(session, pair)),
			// Page-local index keeps the value under Discord's 100-char cap.
			value: String(index),
			default: selected.has(pair.key),
		})),
	)
}

function describePrice(price: { over: number; under: number }): string {
	return `Over ${formatPrice(price.over)} / Under ${formatPrice(price.under)}`.slice(
		0,
		100,
	)
}

function buttonRow(
	session: PropPickerSession,
	pageData: PropPickerPage,
	selected: ReadonlySet<string>,
): MessageActionRowComponentBuilder[] {
	const token = session.token
	const hasSelection = selected.size > 0
	return [
		new ButtonBuilder()
			.setCustomId(encodePropPickerId(token, 'prev'))
			.setLabel('Previous')
			.setStyle(ButtonStyle.Secondary)
			.setDisabled(pageData.page === 0),
		new ButtonBuilder()
			.setCustomId(encodePropPickerId(token, 'next'))
			.setLabel('Next')
			.setStyle(ButtonStyle.Secondary)
			.setDisabled(pageData.page >= pageData.pages - 1),
		new ButtonBuilder()
			.setCustomId(encodePropPickerId(token, 'clear'))
			.setLabel('Clear')
			.setStyle(ButtonStyle.Secondary)
			.setDisabled(!hasSelection),
		new ButtonBuilder()
			.setCustomId(encodePropPickerId(token, 'preview'))
			.setLabel('Preview')
			.setStyle(ButtonStyle.Secondary)
			.setDisabled(!hasSelection),
		new ButtonBuilder()
			.setCustomId(encodePropPickerId(token, 'post'))
			.setLabel('Post')
			.setStyle(ButtonStyle.Success)
			.setDisabled(!hasSelection),
	]
}

/** Ephemeral list of the selected pairs, with the prices shown on Post. */
export function propPickerPreviewPayload(session: PropPickerSession) {
	const selected = selectedPropPickerPairs(session.pairs, session.selected)
	const lines = selected.slice(0, 15).map((pair, index) => {
		const price = session.prices[pair.key] ?? {
			over: pair.overPrice,
			under: pair.underPrice,
		}
		return `${index + 1}. **${pair.player ?? 'Prop'}** · ${marketName(pair.marketKey)}${pair.line === null ? '' : ` \`${pair.line}\``} — Over ${formatPrice(price.over)} / Under ${formatPrice(price.under)}`
	})
	if (selected.length > lines.length) {
		lines.push(`…and ${selected.length - lines.length} more`)
	}
	return v2Payload({
		blocks: [
			text(`## Selected props (${selected.length})`),
			text(lines.length > 0 ? lines.join('\n') : 'Nothing selected yet.'),
			footer(
				'Press Post on the picker to publish. Prices are checked again.',
			),
		],
		ephemeral: true,
	})
}

export function propPickerPostedPayload(result: PostPropsResponseDto) {
	const blocks = [
		text('## Props posted'),
		text(
			`Posted ${result.posted} · Skipped ${result.skipped} · Failed ${result.failed}`,
		),
	]
	if (result.refused.length > 0) {
		blocks.push(
			text(
				result.refused
					.map(
						(refusal) => `• ${refusal.guild_id}: ${refusal.reason}`,
					)
					.join('\n'),
			),
		)
	}
	blocks.push(
		footer(
			'The same ledger and deduplication as daily autopost were used.',
		),
	)
	return v2Payload({ blocks })
}

export function propPickerNotice(content: string) {
	return v2Payload({ blocks: [text(content)], ephemeral: true })
}
