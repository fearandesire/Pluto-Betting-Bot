// Import interfaces and potentially the Discord client type
import { container } from '@sapphire/framework'
import { EmbedBuilder } from 'discord.js'
import { logger } from '../../../logging/WinstonLogger.js'
import MoneyFormatter from '../../common/money-formatting/money-format.js'
import type {
	DisplayBetNotification,
	DisplayBetNotificationLost,
	DisplayBetNotificationPush,
	DisplayBetNotificationWon,
	DisplayResultLost,
	DisplayResultPush,
	DisplayResultWon,
	NotifyBetUsers,
} from './notifications.interface.js'

export default class NotificationService {
	async processBetResults(data: NotifyBetUsers): Promise<void> {
		const hasWinners = data.winners && data.winners.length > 0
		const hasLosers = data.losers && data.losers.length > 0
		const hasPushes = data.pushes && data.pushes.length > 0

		if (!hasWinners && !hasLosers && !hasPushes) {
			logger.info('No notifications to process')
			return
		}

		// Process winners (only if not null and has items)
		if (hasWinners) {
			for (const winner of data.winners!) {
				if (
					winner.result.oldBalance === undefined ||
					winner.result.newBalance === undefined
				) {
					logger.warn({
						method: this.processBetResults.name,
						event: 'notification_balance_unavailable',
						message: `Missing balance data for user ${winner.userId}; sending notification without balance delta`,
					})
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
				const displayResult: DisplayResultWon = {
					...winner.result,
					displayBetAmount,
					displayPayout,
					displayProfit,
					displayNewBalance:
						winner.result.newBalance === undefined
							? 'Unavailable'
							: MoneyFormatter.toUSD(winner.result.newBalance),
					displayOldBalance:
						winner.result.oldBalance === undefined
							? 'Unavailable'
							: MoneyFormatter.toUSD(winner.result.oldBalance),
				}
				const displayWinner: DisplayBetNotificationWon = {
					...winner,
					displayResult,
				}

				// Use displayWinner for user notifications
				await this.notifyUser(displayWinner)
			}
		}

		// Process losers (only if not null and has items)
		if (hasLosers) {
			for (const loser of data.losers!) {
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

				await this.notifyUser(displayLoser)
			}
		}

		// Process pushes (only if present and has items)
		if (hasPushes) {
			for (const push of data.pushes!) {
				const displayResult: DisplayResultPush = {
					...push.result,
					displayBetAmount: MoneyFormatter.toUSD(
						push.result.betAmount,
					),
				}

				const displayPush: DisplayBetNotificationPush = {
					...push,
					displayResult,
				}

				await this.notifyUser(displayPush)
			}
		}
	}

	async notifyUser(betData: DisplayBetNotification) {
		const { userId, betId, result, displayResult } = betData

		switch (result.outcome) {
			case 'won': {
				const {
					team,
					displayBetAmount,
					displayPayout,
					displayProfit,
					displayNewBalance,
					displayOldBalance,
				} = displayResult as DisplayResultWon

				const embed = new EmbedBuilder()
					.setTitle('🎉 Bet Won! 🎉')
					.setColor('#57f287')
					.addFields(
						{ name: '🎯 Team Selected', value: team, inline: true },
						{
							name: '💰 Bet Amount',
							value: displayBetAmount,
							inline: true,
						},
						{
							name: '💫 Profit',
							value: displayProfit,
							inline: true,
						},
						{
							name: '🏆 Total Payout',
							value: displayPayout,
							inline: false,
						},
						{
							name: '📊 Balance Update',
							value: `${displayOldBalance} → ${displayNewBalance}`,
							inline: false,
						},
					)
					.setTimestamp()
					.setFooter({
						text: `Pluto | Bet ID: ${betId}`,
					})

				await this.sendEmbed(userId, betId, embed)
				break
			}

			case 'push': {
				const { team, displayBetAmount } =
					displayResult as DisplayResultPush

				const embed = new EmbedBuilder()
					.setTitle('🔄 Bet Refunded - Tie Game')
					.setColor('#ffa500')
					.addFields(
						{ name: '🎯 Team Selected', value: team, inline: true },
						{
							name: '💵 Refunded Amount',
							value: displayBetAmount,
							inline: true,
						},
						{
							name: 'ℹ️ Reason',
							value: 'The match ended in a tie. Your bet has been refunded.',
							inline: false,
						},
					)
					.setTimestamp()
					.setFooter({
						text: `Pluto | Bet ID: ${betId}`,
					})

				await this.sendEmbed(userId, betId, embed)
				break
			}

			case 'lost': {
				const { team, displayBetAmount } =
					displayResult as DisplayResultLost

				const embed = new EmbedBuilder()
					.setTitle('❌ Bet Lost')
					.setColor('#ff6961')
					.addFields(
						{ name: '🎯 Team Selected', value: team, inline: true },
						{
							name: '💸 Lost',
							value: displayBetAmount,
							inline: true,
						},
					)
					.setTimestamp()
					.setFooter({
						text: `Pluto | Bet ID: ${betId}`,
					})

				await this.sendEmbed(userId, betId, embed)
				break
			}
		}
	}

	private async sendEmbed(
		userId: string,
		betId: number,
		embed: EmbedBuilder,
	): Promise<void> {
		const client = container.client

		if (!client) {
			logger.error({
				method: this.sendEmbed.name,
				message: 'Discord client not available',
				userId,
				betId,
			})
			return
		}

		try {
			await client.users.send(userId, { embeds: [embed] })
		} catch (err) {
			logger.error({
				message: 'Unable to send Discord embed',
				userId,
				betId,
				error: err instanceof Error ? err.message : String(err),
				stack: err instanceof Error ? err.stack : undefined,
				method: this.sendEmbed.name,
			})
		}
	}
}
