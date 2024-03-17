// Import interfaces and potentially the Discord client type
import { SapphireClient } from '@sapphire/framework'
import { ColorResolvable, EmbedBuilder } from 'discord.js'
import embedColors from '../../../../lib/colorsConfig.js'
import logClr from '@pluto-internal-color-logger'
import { IBetResult } from '../../Khronos/bets/bets-interfaces.js'
import { NotifyBetUsers } from '../../common/interfaces/common-interfaces.js'
import MoneyFormatter from '../../common/money-formatting/money-format.js'

export default class NotificationService {
	private client: SapphireClient

	constructor(client: SapphireClient) {
		this.client = client // Use the passed-in client
	}

	async processBetResults(data: NotifyBetUsers): Promise<void> {
		if (
			!data ||
			(data?.winners?.length === 0 && data?.losers?.length === 0)
		) {
			console.info(`No notifications to process`)
			return
		}

		if (data.winners.length > 0) {
			// Process winners
			for (const winner of data.winners) {
				if (!winner.oldBalance || !winner.newBalance) {
					console.error({
						method: this.processBetResults.name,
						message: `Missing balance data for user ${winner.userid}`,
					})
					continue
				}

				// Format currency to $USD
				const { betAmount, payout, profit } =
					await MoneyFormatter.formatAmounts({
						amount: winner.amount,
						payout: winner.payout,
						profit: winner.profit,
					})
				winner.amount = betAmount
				winner.payout = payout
				winner.profit = profit
				winner.oldBalance = MoneyFormatter.toUSD(winner.oldBalance)
				winner.newBalance = MoneyFormatter.toUSD(winner.newBalance)
				await this.notifyUser(winner)
			}
		}
		if (data.losers.length > 0) {
			// Process losers
			for (const loser of data.losers) {
				await this.notifyUser(loser)
			}
		}
	}

	private async notifyUser(betData: IBetResult) {
		const {
			userid,
			betid,
			team,
			amount,
			payout,
			profit,
			newBalance,
			oldBalance,
			betresult,
		} = betData || null

		let msg: string = ''
		let color: ColorResolvable = embedColors.PlutoBrightGreen
		const extraInfo = ''
		if (betresult === `won` && newBalance && oldBalance) {
			msg = `### Congrats, you won your bet! 🎊\n# __Details__\n\n**\`${amount}\`** on the **${team}**\n**Profit:** **\`${profit}\`**\n**Payout:** **\`${payout}\`**\n**Balance**: *\`${oldBalance}\`* → **\`${newBalance}\` 💰**`
			color = embedColors.PlutoBrightGreen
		} else if (betresult === `lost`) {
			msg = `### Bad news...you lost a bet\n# __Details__\n\n${amount} bet on the **${team}**\nBetter luck next time!`
			color = embedColors.PlutoRed
		}
		msg += `\n\n${extraInfo}*Issue? please contact: <@208016830491525120> | Bet ID: \`${betid}\`*`

		const embed = new EmbedBuilder()
			.setTitle(`Bet Result`)
			.setDescription(msg)
			.setColor(color)
			.setFooter({
				text: `Pluto | Dev. fenixforever`,
			})

		try {
			await this.client.users.send(userid, {
				embeds: [embed],
			})
		} catch (err) {
			// User is no longer in the server, or has the bot blocked
			logClr({
				text: `Failed to DM ${userid} | Bet ID: ${betid}\nAccount Privacy issue, Bot blocked, or no longer in the server.`,
				color: `red`,
				status: `error`,
			})
		}
	}
}
