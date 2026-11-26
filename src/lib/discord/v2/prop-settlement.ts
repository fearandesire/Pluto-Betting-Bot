import type { PropSettledNotification } from '../../../utils/api/routes/shared-payload-schemas.js'
import { propRowResultLines } from '../builders/props.js'

/**
 * Discord component types this patch understands. Values are stable Discord
 * API numbers, not discord.js enum members, so the helper also works on raw
 * payloads from the REST API.
 */
const ACTION_ROW = 1
const BUTTON = 2
const TEXT_DISPLAY = 10

const PROP_BUTTON_PREFIX = 'prop_'
const RESULT_PREFIX = '**Result:'
const TALLY_PREFIX = '-# 📊'

/**
 * One board row's share of the message text budget, before and after its
 * result is added. Four prop rows, the two game rows, headings and footer stay
 * under Discord's 4000-character limit, and the result lines always survive
 * the clamp.
 */
export const PROP_ROW_TEXT_MAX_CHARS = 800

export type ComponentJson = {
	type?: number
	content?: string
	custom_id?: string
	disabled?: boolean
	components?: ComponentJson[]
	[key: string]: unknown
}

/** Builders carry toJSON(); already-serialized components pass through. */
export function toComponentJson(component: unknown): ComponentJson {
	if (
		component &&
		typeof component === 'object' &&
		'toJSON' in component &&
		typeof (component as { toJSON?: unknown }).toJSON === 'function'
	) {
		return (component as { toJSON(): ComponentJson }).toJSON()
	}
	return component as ComponentJson
}

export function toComponentJsonList(
	components: readonly unknown[],
): ComponentJson[] {
	return components.map(toComponentJson)
}

/**
 * Disable only the row holding the settled outcome. Other rows keep their
 * buttons so the rest of a board stays pickable.
 */
export function disableSettledPropRow(
	components: readonly ComponentJson[],
	outcomeUuid: string,
): { components: ComponentJson[]; touched: boolean } {
	const cloned = structuredClone(components) as ComponentJson[]
	const touched = disableRow(cloned, outcomeUuid)
	return { components: cloned, touched }
}

function disableRow(nodes: ComponentJson[], outcomeUuid: string): boolean {
	for (const node of nodes) {
		if (isSettledRow(node, outcomeUuid)) {
			for (const button of node.components ?? []) {
				if (
					button.type === BUTTON &&
					typeof button.custom_id === 'string' &&
					button.custom_id.startsWith(PROP_BUTTON_PREFIX)
				) {
					button.disabled = true
				}
			}
			return true
		}
		if (node.components && disableRow(node.components, outcomeUuid)) {
			return true
		}
	}
	return false
}

/**
 * Components V2 board update: rewrite only the settled pair's text block and
 * disable only its row. The heading, the other pairs and their buttons stay
 * byte-for-byte as they were.
 */
export function settleV2BoardComponents(
	components: readonly ComponentJson[],
	data: PropSettledNotification,
): { components: ComponentJson[]; touched: boolean } {
	const cloned = structuredClone(components) as ComponentJson[]
	const touched = patchV2Nodes(cloned, data)
	return { components: cloned, touched }
}

function patchV2Nodes(
	nodes: ComponentJson[],
	data: PropSettledNotification,
): boolean {
	for (let index = 0; index < nodes.length; index++) {
		const node = nodes[index]
		if (isSettledRow(node, data.outcome_uuid)) {
			for (const button of node.components ?? []) {
				if (
					button.type === BUTTON &&
					typeof button.custom_id === 'string' &&
					button.custom_id.startsWith(PROP_BUTTON_PREFIX)
				) {
					button.disabled = true
				}
			}
			const rowText = precedingTextDisplay(nodes, index)
			if (rowText) {
				rowText.content = mergeResult(rowText.content ?? '', data)
			}
			return true
		}
		if (node.components && patchV2Nodes(node.components, data)) {
			return true
		}
	}
	return false
}

function isSettledRow(node: ComponentJson, outcomeUuid: string): boolean {
	return (
		node.type === ACTION_ROW &&
		Array.isArray(node.components) &&
		node.components.some(
			(button) =>
				button.type === BUTTON &&
				button.custom_id === `${PROP_BUTTON_PREFIX}${outcomeUuid}`,
		)
	)
}

/** The pair's text block immediately precedes its button row. */
function precedingTextDisplay(
	nodes: readonly ComponentJson[],
	rowIndex: number,
): ComponentJson | undefined {
	for (let index = rowIndex - 1; index >= 0; index--) {
		if (nodes[index].type === TEXT_DISPLAY) return nodes[index]
	}
	return undefined
}

/** Replace an earlier result instead of appending it twice on retry. */
function mergeResult(content: string, data: PropSettledNotification): string {
	const existing = content
		.split('\n')
		.filter(
			(line) =>
				!line.startsWith(RESULT_PREFIX) &&
				!line.startsWith(TALLY_PREFIX),
		)
		.join('\n')
	const suffix = propRowResultLines(data).join('\n')
	const room = PROP_ROW_TEXT_MAX_CHARS - suffix.length - 1
	const head =
		existing.length > room
			? `${existing.slice(0, Math.max(0, room - 1))}…`
			: existing
	return head ? `${head}\n${suffix}` : suffix
}
