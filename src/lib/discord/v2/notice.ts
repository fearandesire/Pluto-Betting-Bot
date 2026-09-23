import {
	type CommandInteraction,
	type EmbedBuilder,
	type Message,
	MessageFlags,
	type RepliableInteraction,
} from 'discord.js'
import { isV2Message } from './edit.js'
import { text, v2Payload } from './kit.js'

/** `CommandInteraction` is listed because legacy callers type it that way. */
type NoticeInteraction = RepliableInteraction | CommandInteraction

export type NoticeBranch = 'v2-followup' | 'classic-edit' | 'classic-reply'

/**
 * The message an `editReply` would touch. `@original` is the component's
 * message after `deferUpdate` and the new reply after `deferReply`, so
 * `fetchReply` is right for both; `interaction.message` is the fallback.
 */
async function currentMessage(interaction: NoticeInteraction) {
	try {
		return await interaction.fetchReply()
	} catch {
		return 'message' in interaction ? interaction.message : null
	}
}

/**
 * Show an error embed without breaking a Components V2 surface. Editing a V2
 * message with `embeds` is a Discord 400, so a V2 target gets an ephemeral V2
 * follow-up instead. Classic targets keep the caller's behaviour
 * (`opts.classic`, default `editReply({ embeds })`).
 */
export async function sendErrorNotice(
	interaction: NoticeInteraction,
	embed: EmbedBuilder,
	opts: { classic?: (embed: EmbedBuilder) => Promise<Message> } = {},
): Promise<{ branch: NoticeBranch; message: Message }> {
	if (!interaction.deferred && !interaction.replied) {
		const res = await interaction.reply({
			embeds: [embed],
			flags: MessageFlags.Ephemeral,
			withResponse: true,
		})
		return {
			branch: 'classic-reply',
			message: res.resource?.message ?? (await interaction.fetchReply()),
		}
	}

	const target = await currentMessage(interaction)
	if (target && isV2Message(target)) {
		const { title, description, color } = embed.data
		const body =
			[title && `**${title}**`, description].filter(Boolean).join('\n') ||
			'Something went wrong. Please try again.'
		const message = await interaction.followUp(
			v2Payload({
				blocks: [text(body)],
				accent: typeof color === 'number' ? color : undefined,
				ephemeral: true,
			}),
		)
		return { branch: 'v2-followup', message }
	}

	const message = opts.classic
		? await opts.classic(embed)
		: await interaction.editReply({ embeds: [embed] })
	return { branch: 'classic-edit', message }
}
