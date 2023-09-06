import { MessageEmbed } from 'discord.js'
import { SapDiscClient } from '#main'
import { logChan as logChanID } from './serverConfig.js'

/**
 * PlutoLogger
 * @namespace
 * Handle logging to the designated server's log channel for Pluto
 * Logs events regarding the application for viewing the backend processes in real-time
 */
export default class PlutoLogger {
	/**
	 *
	 * Send pre-built embed to the log channel
	 * @function sendEmbed
	 * @memberof PlutoLogger
	 * @param {Object} embed
	 * @static
	 */
	static async sendEmbed(embed) {
		const logChan = await SapDiscClient.channels.fetch(
			logChanID,
		)
		await logChan.send({
			embeds: [embed],
		})
	}

	/**
	 * Create embed that will be sent to the designated log channel for the app
	 *
	 * @function log
	 * @memberof PlutoLogger
	 * @static
	 * @async
	 *
	 * @param {object} data - Object containing the data
	 * @param {string | null} data.id - The ID of the log
	 * @param {string} data.description - The description of the log
	 * @param {string} data.footer - The footer of the embed
	 */
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
				color = '#c4f3fd' // Off-White Sky Blue for General Logs
				title = 'General'
				break
			case 1:
				color = '#0000ff' // Blue for Database Logs
				title = 'Database'
				break
			case 2:
				color = '#ff8000' // Orange for Game Scheduling Logs
				title = 'Game Handling'
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
				// Default to General Logs
				color = data?.color || `#c4f3fd`
				title = data?.title || `General`
				break
		}
		const desc = data.description || `N/A`
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
