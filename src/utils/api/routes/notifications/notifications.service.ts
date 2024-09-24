// Import interfaces and potentially the Discord client type
import { SapphireClient } from '@sapphire/framework'
import { ColorResolvable, EmbedBuilder } from 'discord.js'
import logClr from '@utils/bot_res/ColorConsole.js'
import MoneyFormatter from '../../common/money-formatting/money-format.js'
import {
	DisplayBetNotification,
	DisplayBetNotificationLost,
	DisplayBetNotificationWon,
	DisplayResultLost,
	DisplayResultWon,
	NotifyBetUsers,
} from './notifications.interface.js'

export default class NotificationService {
	async processBetResults(
		data: NotifyBetUsers,
		client: SapphireClient,
	): Promise<void> {
		if (!data || (data.winners.length === 0 && data.losers.length === 0)) {
			console.info(`No notifications to process`)
			return
		}

		if (data.winners.length > 0) {
			for (const winner of data.winners) {
				if (!winner.result.oldBalance || !winner.result.newBalance) {
					console.error({
						method: this.processBetResults.name,
						message: `Missing balance data for user ${winner.userId}`,
					})
					continue
				}

				const formattedAmounts = await MoneyFormatter.formatAmounts({
					amount: winner.result.betAmount,
					payout: winner.result.payout,
					profit: winner.result.profit,
				})
				const {
					betAmount: displayBetAmount,
					payout: displayPayout,
					profit: displayProfit,
				} = formattedAmounts
				// Now, instead of overwriting the original numeric properties,
				// we add them to a new displayResult object
				const displayResult: DisplayResultWon = {
					...winner.result,
					displayBetAmount,
					displayPayout,
					displayProfit,
					displayNewBalance: MoneyFormatter.toUSD(
						winner.result.newBalance,
					),
					displayOldBalance: MoneyFormatter.toUSD(
						winner.result.oldBalance,
					),
				}
				const displayWinner: DisplayBetNotificationWon = {
					...winner,
					displayResult,
				}

				// Use displayWinner for user notifications
				await this.notifyUser(displayWinner, client) // Make sure notifyUser can handle DisplayBetNotificationWon
			}
		}

		if (data.losers.length > 0) {
			for (const loser of data.losers) {
				const displayResult: DisplayResultLost = {
					...loser.result,
					displayBetAmount: MoneyFormatter.toUSD(
						loser.result.betAmount,
					),
				}

				const displayLoser: DisplayBetNotificationLost = {
					...loser,
					displayResult,
				}

				// Use displayLoser for user notifications
				await this.notifyUser(displayLoser, client) // Make sure notifyUser can handle DisplayBetNotificationLost
			}
		}
	}

	async notifyUser(betData: DisplayBetNotification, client: SapphireClient) {
		const { userId, betId, result, displayResult } = betData

		// Basic message setup
		let msg: string = ''
		let color: ColorResolvable = `#57f287` // Assuming this is defined elsewhere

		// Check if the bet result is a win
		if ('profit' in result && 'displayProfit' in displayResult) {
			// It's safe to access properties specific to DisplayResultWon
			const {
				team,
				displayBetAmount,
				displayPayout,
				displayProfit,
				displayNewBalance,
				displayOldBalance,
			} = {
				...displayResult,
			}

			msg = `### Congrats, you won your bet! 🎊\n# __Details__\n\n**\`${displayBetAmount}\`** on the **${team}**\n**Profit:** **\`${displayProfit}\`**\n**Payout:** **\`${displayPayout}\`**\n**Balance**: *\`${displayOldBalance}\`* → **\`${displayNewBalance}\` 💰**`
			color = `#57f287`
		} else if ('betAmount' in result) {
			// Assuming losers always have a betAmount, adjust as necessary
			const { team, displayBetAmount } = {
				team: result.team,
				displayBetAmount: displayResult.displayBetAmount,
			}

			msg = `### Bad news...you lost a bet\n# __Details__\n\n${displayBetAmount} bet on the **${team}**\nBetter luck next time!`
			color = `#ff6961`
		}

		const embed = new EmbedBuilder()
			.setTitle(`Bet Result`)
			.setDescription(msg)
			.setColor(color)
			.setFooter({
				text: `Pluto | Dev. fenixforever`,
			})

		try {
			await client.users.send(userId, {
				embeds: [embed],
			})
		} catch (err) {
			// Log the error with assumed logClr function, ensuring it matches the provided error handling style
			logClr({
				text: `Failed to DM ${userId} | Bet ID: ${betId}\nAccount Privacy issue, Bot blocked, or no longer in the server.`,
				color: `red`,
				status: `error`,
			})
		}
	}
}
