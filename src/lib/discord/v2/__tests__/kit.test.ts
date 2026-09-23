import { ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js'
import { describe, expect, it } from 'vitest'
import {
	accent,
	assertV2Budget,
	divider,
	footer,
	section,
	text,
	V2_MAX_TEXT_CHARS,
	v2EditFlags,
	v2Payload,
} from '../kit.js'
import {
	expectV2Payload,
	sumTextDisplayChars,
	toJsonComponents,
} from './v2-assert.js'

describe('v2Payload', () => {
	it('wraps blocks in one container with V2 flag, no classic fields, mentions off', () => {
		const p = v2Payload({
			accent: 0xc8eefb,
			blocks: [text('# Hi'), divider(), text('body')],
		})
		// container + 3 children
		expectV2Payload(p, {
			flags: MessageFlags.IsComponentsV2,
			components: 4,
		})
		expect(p.allowedMentions).toEqual({ parse: [] })
		const [container] = toJsonComponents(p) as Array<{
			accent_color?: number
		}>
		expect(container.accent_color).toBe(0xc8eefb)
	})

	it('adds Ephemeral only when asked', () => {
		const p = v2Payload({ blocks: [text('x')], ephemeral: true })
		expectV2Payload(p, {
			flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
			components: 2,
		})
	})

	it('clamps text across all blocks together and never throws', () => {
		const big = 'x'.repeat(3000)
		const p = v2Payload({ blocks: [text(big), text(big)] })
		const total = sumTextDisplayChars(toJsonComponents(p))
		expect(total).toBeLessThanOrEqual(V2_MAX_TEXT_CHARS)
		expect(total).toBe(V2_MAX_TEXT_CHARS)
	})

	it('drops blocks that no longer fit the 40-component budget', () => {
		const blocks = Array.from({ length: 60 }, (_, i) => text(`line ${i}`))
		const p = v2Payload({ blocks })
		expect(() => assertV2Budget(p)).not.toThrow()
	})

	it('puts action rows inside the container', () => {
		const btn = new ButtonBuilder()
			.setCustomId('t.v1.go')
			.setLabel('Go')
			.setStyle(ButtonStyle.Primary)
		const p = v2Payload({ blocks: [text('x')], actions: [[btn]] })
		// container + text + row + button
		expectV2Payload(p, {
			flags: MessageFlags.IsComponentsV2,
			components: 4,
		})
	})
})

describe('helpers', () => {
	it('footer renders as small subtext', () => {
		expect(footer('Pluto').toJSON()).toMatchObject({ content: '-# Pluto' })
	})

	it('section with a button accessory counts accessory', () => {
		const btn = new ButtonBuilder()
			.setCustomId('t.v1.x')
			.setLabel('X')
			.setStyle(ButtonStyle.Secondary)
		const p = v2Payload({ blocks: [section('hello', btn)] })
		// container + section + text + accessory
		expectV2Payload(p, {
			flags: MessageFlags.IsComponentsV2,
			components: 4,
		})
	})

	it('accent converts colorsConfig hex strings to numbers', () => {
		expect(accent('PlutoBlue')).toBe(0xc8eefb)
		expect(accent('error')).toBe(0xaa2d2d)
	})

	it('v2EditFlags is the V2 bit alone', () => {
		expect(v2EditFlags()).toBe(MessageFlags.IsComponentsV2)
	})

	it('assertV2Budget throws over the text limit', () => {
		const fake = {
			flags: MessageFlags.IsComponentsV2,
			components: [
				{ type: 10, content: 'x'.repeat(V2_MAX_TEXT_CHARS + 1) },
			],
		}
		expect(() => assertV2Budget(fake)).toThrow(/4000/)
	})
})

describe('text over the per-display limit', () => {
	it('clamps instead of letting discord.js throw', () => {
		const t = text('x'.repeat(V2_MAX_TEXT_CHARS + 500))
		expect(t.data.content).toHaveLength(V2_MAX_TEXT_CHARS)
		expect(t.data.content?.endsWith('…')).toBe(true)
	})
})
