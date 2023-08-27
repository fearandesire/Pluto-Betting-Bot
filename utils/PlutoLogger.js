import discord from 'discord.js'
import { SapDiscClient } from '#main'
import { serverConf } from './serverConfig.js'

const { EmbedBuilder } = discord
export default class PlutoLogger {
	static async log(data) {
		const logChan = await SapDiscClient.channels.fetch(
			serverConf.logChan,
		)
		// # Pre-Built Embed for Log Channel
		const logsEmbed = new EmbedBuilder()
		const color = data?.color || `#ff0000`
		const title = data?.title || `Logs`
		const desc = data?.description || `N/A`
		const footer = data?.footer || {
			text: `Pluto | Dev. by fenixforever`,
		}
		logsEmbed.setColor(color)
		logsEmbed.setTitle(title)
		logsEmbed.setDescription(desc)
		logsEmbed.setFooter(footer)
		// # Send embed to modChan
		await logChan.send({
			content: data?.content,
			embeds: [logsEmbed],
		})
	}
}
