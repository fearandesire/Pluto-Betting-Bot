import { AttachmentBuilder, ButtonBuilder, ButtonStyle } from 'discord.js'
import { accent, footer, gallery, text, v2Payload } from '../v2/kit.js'
import { encodeAchievementsView } from './achievements.js'

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

/** The Achievements button comes from the route alone, so the rebuild after sharing keeps it. */
export function profileCardPayload(opts: {
	png: Buffer
	route: ProfileShareRoute
	shared?: boolean
	badgeLine?: string | null
}) {
	const achievements = new ButtonBuilder()
		.setCustomId(encodeAchievementsView(opts.route.targetId))
		.setLabel('Achievements')
		.setStyle(ButtonStyle.Secondary)
	const share = new ButtonBuilder()
		.setCustomId(encodeProfileShare(opts.route))
		.setLabel(opts.shared ? 'Shared' : 'Share to channel')
		.setStyle(ButtonStyle.Secondary)
		.setDisabled(Boolean(opts.shared))
	return v2Payload({
		blocks: [
			gallery([`attachment://${PROFILE_CARD_FILENAME}`]),
			...(opts.badgeLine ? [text(opts.badgeLine)] : []),
		],
		actions: [[achievements, share]],
		files: [cardAttachment(opts.png)],
	})
}

/** Public post made by the Share button. Names the sharer without pinging. */
export function profileSharedPayload(
	png: Buffer,
	sharerId: string,
	badgeLine?: string | null,
) {
	return v2Payload({
		blocks: [
			gallery([`attachment://${PROFILE_CARD_FILENAME}`]),
			...(badgeLine ? [text(badgeLine)] : []),
			footer(`Shared by <@${sharerId}>`),
		],
		files: [cardAttachment(png)],
	})
}

type MessageNode = {
	type: number
	content?: string
	components?: MessageNode[]
}
const CONTAINER = 17
const TEXT_DISPLAY = 10

/**
 * Reads the badge line back from a card message so the public copy matches
 * the preview. Returns null for a card without one, such as a message posted
 * before badge lines existed.
 */
export function readProfileBadgeLine(message: {
	components?: Array<{ toJSON(): unknown }>
}): string | null {
	const lines = (message.components ?? [])
		.map((component) => component.toJSON() as MessageNode)
		.filter((node) => node.type === CONTAINER)
		.flatMap((node) => node.components ?? [])
		.filter((node) => node.type === TEXT_DISPLAY)
	return lines.length === 1 ? (lines[0].content ?? null) : null
}

export function profileNoticePayload(message: string) {
	return v2Payload({
		accent: accent('error'),
		blocks: [text(message)],
	})
}
