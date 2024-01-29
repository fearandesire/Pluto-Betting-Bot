import discord, { ColorResolvable, CommandInteraction } from 'discord.js'
import color from 'color'
import embedColors from '../../../lib/colorsConfig.js'
import { GuildManager } from '../classes/GuildManager.js'

const { EmbedBuilder } = discord

/**
 * @module embedReply
 * @description Constructor function for creating & sending embeds
 * @param {message} interaction The message object that was sent.
 * @param {embedContent} embedContent Object supplied to be converted into an embed.
 * Example model of a `embedContent`:
 *
 * ```embedContent = { title: '', description: '', color: '', footer: '', fields: [ { name: '', value: '', inline: '' }, etc. ] }```
 * @returns {embed} embedWithFields or noFieldsEmbed - self-descriptive returns.
 */

interface EmbedContent {
	title?: string
	description?: string
	color?: string
	footer?: string
	fields?: any
	target?: string
	ephemeral?: boolean
	followUp?: boolean
	thumbnail?: string
}

export async function embedReply(
	interaction: CommandInteraction,
	embedContent: EmbedContent,
) {
	if (!interaction.guild)
		throw new Error(`Unable to locate a guild from the interaction`)
	const guildMngr = new GuildManager(interaction.guild.id)
	const embedColor: ColorResolvable = embedContent.color
		? await convertColor(embedContent.color)
		: (`#f1c40f` as ColorResolvable)
	const thumbnail = embedContent.thumbnail || (await guildMngr.guildImg())
	const target = embedContent.target || 'reply'
	const isDeferred = interaction?.deferred || false
	const isFollowUp = !!isDeferred
	const followUp = embedContent.followUp || isFollowUp || false

	if (!embedContent.fields) {
		await sendEmbedNoFields(
			interaction,
			embedContent,
			thumbnail,
			embedColor,
			target,
			followUp,
			guildMngr,
		)
	} else {
		await sendEmbedWithFields(
			interaction,
			embedContent,
			thumbnail,
			embedColor,
			target,
			followUp,
			guildMngr,
		)
	}
}

async function sendEmbedNoFields(
	interaction: CommandInteraction,
	embedContent: EmbedContent,
	thumbnail: string,
	embedColor: ColorResolvable,
	target: string,
	followUp: boolean,
	guildMngr: GuildManager,
) {
	const embed = new EmbedBuilder()
		.setColor(embedColor)
		.setTitle(embedContent.title || '')
		.setThumbnail(thumbnail)
		.setDescription(embedContent.description || '')
		.setFooter({
			text: embedContent.footer || 'Pluto | Dev. by fenixforever',
		})

	const responseOptions = {
		embeds: [embed],
	}

	if (target === 'reply') {
		if (!interaction.replied) {
			return interaction.reply(responseOptions)
		} else if (followUp) {
			return interaction.followUp(responseOptions)
		}
	} else {
		const reqChan = await guildMngr.fetchChannelViaId(target)
		return reqChan.send(responseOptions)
	}
}

async function sendEmbedWithFields(
	interaction: CommandInteraction,
	embedContent: EmbedContent,
	thumbnail: string,
	embedColor: ColorResolvable,
	target: string,
	followUp: boolean,
	guildMngr: GuildManager,
) {
	const embed = new EmbedBuilder()
		.setColor(embedColor)
		.setTitle(embedContent.title || '')
		.setDescription(embedContent.description || '')
		.addFields(...embedContent.fields)
		.setThumbnail(thumbnail)
		.setFooter({
			text: embedContent.footer || 'Pluto | Dev. by fenixforever',
		})

	const responseOptions = {
		embeds: [embed],
	}

	if (target === 'reply') {
		if (followUp) {
			return interaction.followUp(responseOptions)
		}
		return interaction.reply(responseOptions)
	} else if (target !== 'reply') {
		const reqChan = await guildMngr.fetchChannelViaId(target)
		return reqChan.send(responseOptions)
	}
}

export async function convertColor(
	colorCode: string | number,
): Promise<ColorResolvable> {
	return color(colorCode).rgbNumber().toString() as ColorResolvable
}

export async function guildImgURL(guildId: string): Promise<string> {
	return `https://i.imgur.com/mFDP96p.png`
}

export async function sendErrorEmbed(
	interaction: CommandInteraction,
	str: string,
	replyType: number,
) {
	const errorEmb = new EmbedBuilder()
		.setColor(embedColors.error)
		.setTitle('🚩 Error')
		.setDescription(str)
		.setFooter({ text: `Pluto | Dev. by fenixforever` })
		.setTimestamp()
	if (replyType === 1) {
		return interaction.editReply({
			content: ``,
			embeds: [errorEmb],
			components: [],
		})
	}
	if (replyType === 2) {
		return interaction.followUp({
			content: ``,
			embeds: [errorEmb],
			components: [],
		})
	}
	if (replyType === 3) {
		return interaction.reply({
			content: ``,
			embeds: [errorEmb],
			components: [],
		})
	}
	return interaction.followUp({
		content: ``,
		embeds: [errorEmb],
		components: [],
	})
}

export async function QuickError(
	message: CommandInteraction,
	text: string,
	interactionEph?: boolean,
) {
	const embed = new EmbedBuilder()
		.setColor('#ff0000')
		.setTitle(':triangular_flag_on_post: Error')
		.setDescription(text)
		.setFooter({ text: 'Pluto | Dev. by fenixforever' })
	if (message?.deferred === true) {
		if (interactionEph === true) {
			await message.followUp({
				embeds: [embed],
				ephemeral: true,
			})
		} else {
			await message.followUp({ embeds: [embed] })
		}
	} else {
		if (interactionEph === true) {
			message.reply({
				embeds: [embed],
				ephemeral: true,
			})
			return
		}
		if (!interactionEph) {
			message.reply({ embeds: [embed] })
			return
		}
		if (interactionEph === true) {
			message.followUp({
				embeds: [embed],
				ephemeral: true,
			})
		} else if (!interactionEph) {
			message.followUp({ embeds: [embed] })
		}
	}
}
