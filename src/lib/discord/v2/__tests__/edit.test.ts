import {
	AttachmentBuilder,
	MessageFlags,
	MessageFlagsBitField,
	MessagePayload,
	Routes,
} from 'discord.js'
import { describe, expect, it, vi } from 'vitest'
import {
	buildV2EditBody,
	editInteractionToV2,
	editMessageToV2,
	isV2Message,
} from '../edit.js'
import { text, v2Payload } from '../kit.js'

describe('discord.js 14.26.3 edit serialization (why edit.ts uses REST)', () => {
	it('coerces content:null to "" so message.edit cannot clear content', () => {
		const p = new MessagePayload({} as never, { content: null })
		expect(p.makeContent()).toBe('')
	})
})

describe('buildV2EditBody', () => {
	it('explicitly nulls every classic field and clears old attachments', () => {
		const body = buildV2EditBody(v2Payload({ blocks: [text('hi')] }))
		expect(body).toEqual({
			content: null,
			embeds: [],
			poll: null,
			sticker_ids: [],
			attachments: [],
			flags: MessageFlags.IsComponentsV2,
			allowed_mentions: { parse: [] },
			components: [
				{ type: 17, components: [{ type: 10, content: 'hi' }] },
			],
		})
	})

	it('drops Ephemeral, which Discord rejects on edits', () => {
		const body = buildV2EditBody(
			v2Payload({ blocks: [text('x')], ephemeral: true }),
		)
		expect(body.flags).toBe(MessageFlags.IsComponentsV2)
	})

	it('lists new files as attachments by index', () => {
		const file = new AttachmentBuilder(Buffer.from('png'), {
			name: 'a.png',
		})
		const body = buildV2EditBody(
			v2Payload({ blocks: [text('x')], files: [file] }),
		)
		expect(body.attachments).toEqual([{ id: 0, filename: 'a.png' }])
	})
})

describe('senders', () => {
	const payload = v2Payload({ blocks: [text('x')] })

	it('editMessageToV2 PATCHes the channel message route', async () => {
		const patch = vi.fn().mockResolvedValue({})
		const msg = {
			id: 'm1',
			channelId: 'c1',
			client: { rest: { patch } },
		}
		await editMessageToV2(msg as never, payload)
		expect(patch).toHaveBeenCalledWith(Routes.channelMessage('c1', 'm1'), {
			body: buildV2EditBody(payload),
			files: [],
		})
	})

	it('editInteractionToV2 PATCHes @original via the interaction webhook', async () => {
		const patch = vi.fn().mockResolvedValue({})
		const interaction = {
			applicationId: 'app',
			token: 'tok',
			client: { rest: { patch } },
		}
		await editInteractionToV2(interaction as never, payload)
		expect(patch).toHaveBeenCalledWith(
			Routes.webhookMessage('app', 'tok', '@original'),
			{ body: buildV2EditBody(payload), files: [], auth: false },
		)
	})

	it('isV2Message reads the message flag', () => {
		const v2 = {
			flags: new MessageFlagsBitField(MessageFlags.IsComponentsV2),
		}
		const classic = { flags: new MessageFlagsBitField(0) }
		expect(isV2Message(v2 as never)).toBe(true)
		expect(isV2Message(classic as never)).toBe(false)
	})
})
