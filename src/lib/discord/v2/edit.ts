import {
	type AttachmentBuilder,
	type Interaction,
	type Message,
	MessageFlags,
	Routes,
} from 'discord.js'
import type { V2MessagePayload } from './kit.js'

type RawFile = { name: string; data: Buffer }

export const isV2Message = (msg: Pick<Message, 'flags'>) =>
	msg.flags.has(MessageFlags.IsComponentsV2)

/**
 * REST body that converts any message (classic or V2) into the given V2
 * payload. Discord only allows the switch when content/embeds/poll/stickers
 * are explicitly cleared; discord.js `message.edit` turns `content: null`
 * into `""` and drops `poll: null`, so we build the body ourselves.
 */
export function buildV2EditBody(payload: V2MessagePayload) {
	return {
		content: null,
		embeds: [],
		poll: null,
		sticker_ids: [],
		attachments: (payload.files ?? []).map((f, id) => ({
			id,
			filename: f.name ?? `file${id}`,
		})),
		flags: MessageFlags.IsComponentsV2,
		allowed_mentions: payload.allowedMentions,
		components: payload.components.map((c) => c.toJSON()),
	}
}

function toRawFiles(files: AttachmentBuilder[] = []): RawFile[] {
	return files.map((f, i) => {
		if (!Buffer.isBuffer(f.attachment)) {
			throw new Error(
				`editToV2 needs Buffer attachments; got ${typeof f.attachment} for ${f.name}`,
			)
		}
		return { name: f.name ?? `file${i}`, data: f.attachment }
	})
}

/** Edit a channel message (possibly posted before deploy, possibly classic) into V2. */
export function editMessageToV2(
	msg: Pick<Message, 'id' | 'channelId' | 'client'>,
	payload: V2MessagePayload,
) {
	return msg.client.rest.patch(Routes.channelMessage(msg.channelId, msg.id), {
		body: buildV2EditBody(payload),
		files: toRawFiles(payload.files),
	})
}

/** Edit an interaction's original reply into V2 (e.g. a classic reply sent before deploy). */
export function editInteractionToV2(
	interaction: Pick<Interaction, 'applicationId' | 'token' | 'client'>,
	payload: V2MessagePayload,
) {
	return interaction.client.rest.patch(
		Routes.webhookMessage(
			interaction.applicationId,
			interaction.token,
			'@original',
		),
		{
			body: buildV2EditBody(payload),
			files: toRawFiles(payload.files),
			auth: false,
		},
	)
}
