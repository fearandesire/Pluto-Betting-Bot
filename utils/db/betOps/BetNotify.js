import discord from 'discord.js'
import embedColors from '../../../lib/colorsConfig.js'
import logClr from '#colorConsole'

const { EmbedBuilder } = discord

/**
 * Send notifications for bet results via DM to users
 *
 */
export default class BetNotify {
	/**
	 * @param {Client} client - Discord.js Client instance
	 */
	constructor(client) {
		this.client = client
	}

	async notifyUser(userId, betData) {
		const {
			betId,
			teamBetOn,
			betAmount,
			payout,
			profit,
			currentBalance,
			oldBalance,
			betResult,
		} = betData || null

		let msg
		let color
		if (betResult === `won`) {
			const newUserBal = Math.floor(currentBalance)
			msg = `You won your bet on the ${teamBetOn}! :moneybag: \n\n**You had bet:** **\`$${betAmount}\`**\n**Profit:** **\`$${profit}\`**\n**Payout:** **\`$${payout}\`**\n**Balance**: *\`$${oldBalance}\`* => **\`$${newUserBal}\`**`
			color = embedColors.PlutoBrightGreen
		} else if (betResult === `lost`) {
			msg = `You lost your $${betAmount} bet on the ${teamBetOn}.\nSorry, better luck next time!`
			color = embedColors.PlutoRed
		}

		msg += `\n\n*See an issue here? Please contact <@208016830491525120> | Bet ID: ${betId}*`

		const embed = new EmbedBuilder()
			.setTitle(`Bet Result`)
			.setDescription(msg)
			.setColor(color)
			.setFooter({
				text: `Pluto | Dev. fenixforever`,
			})

		try {
			await this.client.users.send(userId, {
				embeds: [embed],
			})
		} catch (err) {
			// User is no longer in the server, or has the bot blocked
			await logClr({
				text: `Failed to DM ${userId} | Bet ID: ${betId}\nAccount Privacy issue, Bot blocked, or no longer in the server.`,
				color: `red`,
				status: `error`,
			})
		}
	}
}
