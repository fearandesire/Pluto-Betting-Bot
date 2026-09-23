import { expect } from 'vitest'

type JsonComponent = {
	type: number
	content?: string
	components?: JsonComponent[]
	accessory?: JsonComponent
	items?: unknown[]
}

type SerializablePayload = {
	flags?: number
	components?: Array<{ toJSON(): unknown } | JsonComponent>
	[key: string]: unknown
}

export function toJsonComponents(
	payload: SerializablePayload,
): JsonComponent[] {
	return (payload.components ?? []).map((c) =>
		'toJSON' in c && typeof c.toJSON === 'function'
			? (c.toJSON() as JsonComponent)
			: (c as JsonComponent),
	)
}

/** Counts every component, nested ones included, the way Discord's 40-component limit does. */
export function countComponents(components: JsonComponent[]): number {
	let total = 0
	for (const c of components) {
		total += 1
		if (c.components) total += countComponents(c.components)
		if (c.accessory) total += 1
	}
	return total
}

export function sumTextDisplayChars(components: JsonComponent[]): number {
	let total = 0
	for (const c of components) {
		if (typeof c.content === 'string') total += c.content.length
		if (c.components) total += sumTextDisplayChars(c.components)
	}
	return total
}

/**
 * Exact assertions for a Components V2 payload: flags pinned, classic fields
 * absent, component count exact and within Discord's limit.
 */
export function expectV2Payload(
	payload: SerializablePayload,
	expected: { flags: number; components: number },
) {
	expect(payload.flags).toBe(expected.flags)
	expect('embeds' in payload).toBe(false)
	expect('content' in payload).toBe(false)
	const count = countComponents(toJsonComponents(payload))
	expect(count).toBe(expected.components)
	expect(count).toBeLessThanOrEqual(40)
}
