import { AttachmentBuilder, ButtonBuilder, ButtonStyle } from 'discord.js'
import { accent, footer, gallery, text, v2Payload } from '../v2/kit.js'

export const PROFILE_CARD_FILENAME = 'profile-card.png'

const SHARE_PREFIX = 'profile.v1.share'
const SNOWFLAKE = /^\d{17,20}$/

export interface ProfileShareRoute {
	/** The invoker; only this user may share the card. */
	ownerId: string
	/** The user the card shows. */
	targetId: string
}

/** `profile.v1.share.<ownerId>.<targetId>` */
export function encodeProfileShare({
	ownerId,
	targetId,
}: ProfileShareRoute): string {
	if (!SNOWFLAKE.test(ownerId) || !SNOWFLAKE.test(targetId))
		throw new Error('invalid profile share ids')
	return `${SHARE_PREFIX}.${ownerId}.${targetId}`
}

export function decodeProfileShare(customId: string): ProfileShareRoute | null {
	const parts = customId.split('.')
	if (parts.length !== 5) return null
	const [ns, version, action, ownerId, targetId] = parts
	if (`${ns}.${version}.${action}` !== SHARE_PREFIX) return null
	if (!SNOWFLAKE.test(ownerId) || !SNOWFLAKE.test(targetId)) return null
	return { ownerId, targetId }
}

const cardAttachment = (png: Buffer) =>
	new AttachmentBuilder(png, {
		name: PROFILE_CARD_FILENAME,
		description: 'Pluto profile card',
	})

/** Ephemeral reply: the card plus the Share button (disabled once shared). */
export function profileCardPayload(opts: {
	png: Buffer
	route: ProfileShareRoute
	shared?: boolean
}) {
	const button = new ButtonBuilder()
		.setCustomId(encodeProfileShare(opts.route))
		.setLabel(opts.shared ? 'Shared' : 'Share to channel')
		.setStyle(ButtonStyle.Secondary)
		.setDisabled(Boolean(opts.shared))
	return v2Payload({
		blocks: [gallery([`attachment://${PROFILE_CARD_FILENAME}`])],
		actions: [[button]],
		files: [cardAttachment(opts.png)],
	})
}

/** Public post made by the Share button. Names the sharer without pinging. */
export function profileSharedPayload(png: Buffer, sharerId: string) {
	return v2Payload({
		blocks: [
			gallery([`attachment://${PROFILE_CARD_FILENAME}`]),
			footer(`Shared by <@${sharerId}>`),
		],
		files: [cardAttachment(png)],
	})
}

export function profileNoticePayload(message: string) {
	return v2Payload({
		accent: accent('error'),
		blocks: [text(message)],
	})
}
