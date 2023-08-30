import { MessageEmbed } from 'discord.js'
import { SapDiscClient } from '#main'
import { logChan as logChanID } from './serverConfig.js'

export default class PlutoLogger {
	static async log(data) {
		const logChan = await SapDiscClient.channels.fetch(
			logChanID,
		)
		let color
		let title
		// # Pre-Built Embed for Log Channel
		const logsEmbed = new MessageEmbed()
		switch (data?.id) {
			case 0:
				color = '#00ff00' // Green for General Logs
				title = 'General'
				break
			case 1:
				color = '#0000ff' // Blue for Database Logs
				title = 'Database'
				break
			case 2:
				color = '#ffff00' // Yellow for Game Scheduling Logs
				title = 'Game Scheduling'
				break
			case 3:
				color = '#ff00ff' // Magenta for Betting Logs
				title = 'Betting'
				break
			case 4:
				color = '#ff0000' // Red for Error Logs
				title = 'Error'
				break
			default:
				color = data?.color || `#ff0000`
				title = data?.title || `Logs`
				break
		}
		const desc = data?.description || `N/A`
		const footer = data?.footer || {
			text: `Pluto | Dev. by fenixforever`,
		}
		logsEmbed.setColor(color)
		logsEmbed.setTitle(`${title} Logs`)
		logsEmbed.setDescription(desc)
		logsEmbed.setFooter(footer)
		// # Send embed to modChan
		await logChan.send({
			content: data?.content,
			embeds: [logsEmbed],
		})
	}
}
