import { type ColorResolvable, EmbedBuilder } from 'discord.js'

export type InfoData = {
	title: string
	description: string
	color: ColorResolvable
	thumbnail?: string
	footer: string
	url?: string
}

/** Classic embed for /help, /faq, /commands (surface G1). */
export function infoEmbed(info: InfoData) {
	const embed = new EmbedBuilder()
		.setTitle(info.title)
		.setDescription(info.description)
		.setColor(info.color)
		.setFooter({ text: info.footer })
	if (info.thumbnail) embed.setThumbnail(info.thumbnail)
	if (info.url) embed.setURL(info.url)
	return embed
}
