import discord from 'discord.js'
import embedColors from '../../../lib/colorsConfig.js'
import logClr from '#colorConsole'
import { bettingChan } from '../../serverConfig.js'

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
		const extraInfo = `Go to the <#${bettingChan}> channel and:\n- View your place on the \`/leaderboard\`\n- Place more bets with \`/bet\`!`
		if (betResult === `won`) {
			const newUserBal = Math.floor(currentBalance)
			msg = `### Congrats, your won your bet! 🎊\n# Details\n\n**\`$${betAmount}\`** on the **${teamBetOn}**\n**Profit:** **\`$${profit}\`**\n**Payout:** **\`$${payout}\`**\n**Balance**: *\`$${oldBalance}\`* => **\`$${newUserBal}\` 💰**`
			color = embedColors.PlutoBrightGreen
		} else if (betResult === `lost`) {
			msg = `### Bad news...you lost a bet\n# Details $${betAmount} bet on the **${teamBetOn}**.\nBetter luck next time!`
			color = embedColors.PlutoRed
		}
		msg += `\n\n${extraInfo}\n*Issues? please contact: <@208016830491525120> | Bet ID: \`${betId}\`*`

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
