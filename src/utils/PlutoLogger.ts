import { EmbedBuilder, type ColorResolvable, type TextChannel } from "discord.js";

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
	 * @param {TextChannel} Discord Channel to send embed
	 * @static
	 */
	static async sendEmbed(embed: EmbedBuilder, logChan: TextChannel) {
		await logChan.send({
			embeds: [embed],
		});
	}

	/**
	 * Create embed that will be sent to the designated log channel for the app
	 *
	 * @function log
	 * @memberof PlutoLogger
	 * @static
	 * @async
	 * @param {TextChannel} logChan - The log channel to send the embed to
	 * @param {object} data - Object containing the data
	 * @param {string | number} data.id - The ID of the log
	 * @param {string} data.description - The description of the log
	 * @param {string} data.footer - The footer of the embed
	 */
	static async log(
		logChan: TextChannel,
		data: {
			id: string | number;
			title?: string;
			color?: string;
			description: string;
			content?: string;
			footer?: string;
		},
	) {
		let color;
		let title;
		// # Pre-Built Embed for Log Channel
		const logsEmbed = new EmbedBuilder();
		switch (data?.id) {
			case 0:
				color = "#c4f3fd"; // Off-White Sky Blue for General Logs
				title = "General";
				break;
			case 1:
				color = "#0000ff"; // Blue for Database Logs
				title = "Database";
				break;
			case 2:
				color = "#ff8000"; // Orange for Game Scheduling Logs
				title = "Game Handling";
				break;
			case 3:
				color = "#ff00ff"; // Magenta for Betting Logs
				title = "Betting";
				break;
			case 4:
				color = "#ff0000"; // Red for Error Logs
				title = "Error";
				break;

			case 5:
				color = "#ffff00"; // Yellow for Warning Logs
				title = "Warning";
				break;
			case "api":
				color = "#9db08d"; // Yellow for Warning Logs
				title = "API";
				break;
			default:
				// Default to General Logs
				color = data?.color || `#c4f3fd`;
				title = data?.title || `General`;
				break;
		}
		const desc = data.description || `N/A`;
		const footer = data?.footer !== null ? data.footer : `N/A`;
		if (!footer) return;
		logsEmbed.setColor(color as ColorResolvable);
		logsEmbed.setTitle(`${title} Logs`);
		logsEmbed.setDescription(desc);
		logsEmbed.setFooter({ text: footer });
		// # Send embed to modChan
		await logChan.send({
			content: data?.content,
			embeds: [logsEmbed],
		});
	}
}
