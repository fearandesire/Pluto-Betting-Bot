import {
	InteractionHandler,
	InteractionHandlerTypes,
} from '@sapphire/framework'
import type { ButtonInteraction } from 'discord.js'
import {
	decodeProfileShare,
	type ProfileShareRoute,
	profileCardPayload,
	profileSharedPayload,
} from '../lib/discord/builders/profile.js'
import { text, v2EditFlags, v2Payload } from '../lib/discord/v2/kit.js'
import { logger } from '../utils/logging/WinstonLogger.js'

const MAX_CARD_BYTES = 2 * 1024 * 1024
const DISCORD_CDN_HOSTS = ['cdn.discordapp.com', 'media.discordapp.net']

/** Ephemeral message ids already shared; one public post per card. */
const claimed = new Set<string>()

const notice = (content: string) =>
	v2Payload({ blocks: [text(content)], ephemeral: true })

/** Reads the card back from the ephemeral message so the public copy is identical. */
async function fetchCardPng(interaction: ButtonInteraction): Promise<Buffer> {
	const url = interaction.message.attachments.first()?.url
	if (!url) throw new Error('profile card attachment missing')
	const { protocol, hostname } = new URL(url)
	if (protocol !== 'https:' || !DISCORD_CDN_HOSTS.includes(hostname))
		throw new Error('profile card attachment is not on the Discord CDN')
	const response = await fetch(url)
	if (!response.ok)
		throw new Error(`profile card download failed (${response.status})`)
	const png = Buffer.from(await response.arrayBuffer())
	if (png.length === 0 || png.length > MAX_CARD_BYTES)
		throw new Error('profile card has an unexpected size')
	return png
}

/** Routes every `profile.v1.share.*` button: posts the card publicly, once, for the invoker only. */
export class ProfileShareHandler extends InteractionHandler {
	public constructor(
		ctx: InteractionHandler.LoaderContext,
		options: InteractionHandler.Options,
	) {
		super(ctx, {
			...options,
			interactionHandlerType: InteractionHandlerTypes.Button,
		})
	}

	public override parse(interaction: ButtonInteraction) {
		const route = decodeProfileShare(interaction.customId)
		return route ? this.some(route) : this.none()
	}

	public override async run(
		interaction: ButtonInteraction,
		route: ProfileShareRoute,
	) {
		if (interaction.user.id !== route.ownerId) {
			await interaction.reply(
				notice('Only the person who ran /profile can share this card.'),
			)
			return
		}

		const messageId = interaction.message.id
		if (claimed.has(messageId)) {
			await interaction.reply(notice('This card was already shared.'))
			return
		}
		claimed.add(messageId)

		await interaction.deferUpdate()
		let png: Buffer
		try {
			png = await fetchCardPng(interaction)
			await interaction.followUp(
				profileSharedPayload(png, interaction.user.id),
			)
		} catch (error) {
			claimed.delete(messageId)
			logger.error({
				message: 'Profile share failed',
				metadata: { source: 'ProfileShareHandler', error },
			})
			try {
				await interaction.followUp(
					notice("Couldn't share the card. Run /profile again."),
				)
			} catch {
				// Interaction token expired; nothing left to tell the user.
			}
			return
		}

		// Already public. A failed button update must not trigger a second post.
		try {
			await interaction.editReply({
				...profileCardPayload({ png, route, shared: true }),
				flags: v2EditFlags(),
			})
		} catch (error) {
			logger.warn({
				message: 'Profile share button could not be disabled',
				metadata: { source: 'ProfileShareHandler', error },
			})
		}
	}
}
