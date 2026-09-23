import {
	ActionRowBuilder,
	type AttachmentBuilder,
	type ButtonBuilder,
	ContainerBuilder,
	MediaGalleryBuilder,
	MediaGalleryItemBuilder,
	type MessageActionRowComponentBuilder,
	MessageFlags,
	type MessageMentionOptions,
	SectionBuilder,
	SeparatorBuilder,
	SeparatorSpacingSize,
	TextDisplayBuilder,
	ThumbnailBuilder,
} from 'discord.js'
import embedColors from '../../colorsConfig.js'

export const V2_MAX_COMPONENTS = 40
export const V2_MAX_TEXT_CHARS = 4000

export type V2Block =
	| TextDisplayBuilder
	| SeparatorBuilder
	| SectionBuilder
	| MediaGalleryBuilder

export type V2MessagePayload = {
	components: ContainerBuilder[]
	flags: MessageFlags.IsComponentsV2 | number
	allowedMentions: MessageMentionOptions
	files?: AttachmentBuilder[]
}

/** discord.js validates length in setContent, so clamp before it throws. */
export const text = (content: string) =>
	new TextDisplayBuilder().setContent(
		content.length > V2_MAX_TEXT_CHARS
			? `${content.slice(0, V2_MAX_TEXT_CHARS - 1)}…`
			: content,
	)

export const divider = (spacing = SeparatorSpacingSize.Small) =>
	new SeparatorBuilder().setDivider(true).setSpacing(spacing)

/** Small grey subtext at the end of a message; V2 replacement for embed footers. */
export const footer = (content: string) => text(`-# ${content}`)

export const thumbnail = (url: string) => new ThumbnailBuilder().setURL(url)

export const gallery = (urls: string[]) =>
	new MediaGalleryBuilder().addItems(
		urls.map((url) => new MediaGalleryItemBuilder().setURL(url)),
	)

/** 1–3 text lines with a thumbnail or button on the right. */
export function section(
	content: string | string[],
	accessory: ThumbnailBuilder | ButtonBuilder,
) {
	const lines = (Array.isArray(content) ? content : [content]).slice(0, 3)
	const s = new SectionBuilder().addTextDisplayComponents(lines.map(text))
	return accessory instanceof ThumbnailBuilder
		? s.setThumbnailAccessory(accessory)
		: s.setButtonAccessory(accessory)
}

/** `colorsConfig` stores hex strings; `setAccentColor` needs a number. */
export function accent(name: keyof typeof embedColors & string): number {
	const hex = embedColors[name]
	if (typeof hex !== 'string' || !hex.startsWith('#')) {
		throw new Error(`colorsConfig.${name} is not a hex string`)
	}
	return Number.parseInt(hex.slice(1), 16)
}

/** Flags for editReply/followUp after a plain defer. Discord rejects Ephemeral on edits. */
export const v2EditFlags = () => MessageFlags.IsComponentsV2 as const

function blockCost(block: V2Block): { components: number; chars: number } {
	const json = block.toJSON() as {
		content?: string
		components?: Array<{ content?: string }>
		accessory?: unknown
		items?: unknown[]
	}
	const chars =
		(json.content?.length ?? 0) +
		(json.components ?? []).reduce(
			(n, c) => n + (c.content?.length ?? 0),
			0,
		)
	const components =
		1 + (json.components?.length ?? 0) + (json.accessory ? 1 : 0)
	return { components, chars }
}

/**
 * Build a Components V2 message: one container holding the blocks and
 * optional button rows. Never throws on overflow — text is clamped across
 * all blocks and trailing blocks are dropped past 40 components.
 */
export function v2Payload(opts: {
	blocks: V2Block[]
	accent?: number
	actions?: MessageActionRowComponentBuilder[][]
	files?: AttachmentBuilder[]
	ephemeral?: boolean
}): V2MessagePayload {
	const container = new ContainerBuilder()
	if (opts.accent !== undefined) container.setAccentColor(opts.accent)

	// Rows are admitted first (controls matter) but only while they fit;
	// blocks then fill whatever budget is left.
	let componentsLeft = V2_MAX_COMPONENTS - 1
	const rows: ActionRowBuilder<MessageActionRowComponentBuilder>[] = []
	for (const r of opts.actions ?? []) {
		const cost = 1 + r.length
		if (cost > componentsLeft) break
		componentsLeft -= cost
		rows.push(
			new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
				r,
			),
		)
	}
	let charsLeft = V2_MAX_TEXT_CHARS

	for (const block of opts.blocks) {
		const cost = blockCost(block)
		if (cost.components > componentsLeft || charsLeft <= 0) break
		if (block instanceof TextDisplayBuilder && cost.chars > charsLeft) {
			const content = block.data.content ?? ''
			block.setContent(`${content.slice(0, charsLeft - 1)}…`)
			charsLeft = 0
		} else if (cost.chars > charsLeft) {
			break
		} else {
			charsLeft -= cost.chars
		}
		componentsLeft -= cost.components
		if (block instanceof TextDisplayBuilder)
			container.addTextDisplayComponents(block)
		else if (block instanceof SeparatorBuilder)
			container.addSeparatorComponents(block)
		else if (block instanceof SectionBuilder)
			container.addSectionComponents(block)
		else container.addMediaGalleryComponents(block)
	}
	if (rows.length) container.addActionRowComponents(rows)

	const payload: V2MessagePayload = {
		components: [container],
		flags:
			MessageFlags.IsComponentsV2 |
			(opts.ephemeral ? MessageFlags.Ephemeral : 0),
		allowedMentions: { parse: [] },
	}
	if (opts.files?.length) payload.files = opts.files
	return payload
}

type JsonNode = {
	content?: string
	components?: JsonNode[]
	accessory?: unknown
}

function walk(nodes: JsonNode[], acc = { components: 0, chars: 0 }) {
	for (const n of nodes) {
		acc.components += 1 + (n.accessory ? 1 : 0)
		acc.chars += n.content?.length ?? 0
		if (n.components) walk(n.components, acc)
	}
	return acc
}

/** Test-only strict check. Production code relies on v2Payload's clamping. */
export function assertV2Budget(payload: {
	components?: Array<{ toJSON(): unknown } | JsonNode>
}) {
	const nodes = (payload.components ?? []).map((c) =>
		'toJSON' in c && typeof c.toJSON === 'function'
			? (c.toJSON() as JsonNode)
			: (c as JsonNode),
	)
	const { components, chars } = walk(nodes)
	if (components > V2_MAX_COMPONENTS)
		throw new Error(
			`V2 message has ${components} components (max ${V2_MAX_COMPONENTS})`,
		)
	if (chars > V2_MAX_TEXT_CHARS)
		throw new Error(
			`V2 message has ${chars} text chars (max ${V2_MAX_TEXT_CHARS})`,
		)
}
