// Import interfaces and potentially the Discord client type
import type { SapphireClient } from '@sapphire/framework';
import { type ColorResolvable, EmbedBuilder } from 'discord.js';
import logClr from '../../../bot_res/ColorConsole.js';
import MoneyFormatter from '../../common/money-formatting/money-format.js';
import type {
	DisplayBetNotification,
	DisplayBetNotificationLost,
	DisplayBetNotificationWon,
	DisplayResultLost,
	DisplayResultWon,
	NotifyBetUsers,
} from './notifications.interface.js';

export default class NotificationService {
	async processBetResults(
		data: NotifyBetUsers,
		client: SapphireClient,
	): Promise<void> {
		if (!data || (data.winners.length === 0 && data.losers.length === 0)) {
			console.info('No notifications to process');
			return;
		}

		if (data.winners.length > 0) {
			for (const winner of data.winners) {
				if (!winner.result.oldBalance || !winner.result.newBalance) {
					console.error({
						method: this.processBetResults.name,
						message: `Missing balance data for user ${winner.userId}`,
					});
					continue;
				}

				const formattedAmounts = await MoneyFormatter.formatAmounts({
					amount: winner.result.betAmount,
					payout: winner.result.payout,
					profit: winner.result.profit,
				});
				const {
					betAmount: displayBetAmount,
					payout: displayPayout,
					profit: displayProfit,
				} = formattedAmounts;
				// Now, instead of overwriting the original numeric properties,
				// we add them to a new displayResult object
				const displayResult: DisplayResultWon = {
					...winner.result,
					displayBetAmount,
					displayPayout,
					displayProfit,
					displayNewBalance: MoneyFormatter.toUSD(winner.result.newBalance),
					displayOldBalance: MoneyFormatter.toUSD(winner.result.oldBalance),
				};
				const displayWinner: DisplayBetNotificationWon = {
					...winner,
					displayResult,
				};

				// Use displayWinner for user notifications
				await this.notifyUser(displayWinner, client); // Make sure notifyUser can handle DisplayBetNotificationWon
			}
		}

		if (data.losers.length > 0) {
			for (const loser of data.losers) {
				const displayResult: DisplayResultLost = {
					...loser.result,
					displayBetAmount: MoneyFormatter.toUSD(loser.result.betAmount),
				};

				const displayLoser: DisplayBetNotificationLost = {
					...loser,
					displayResult,
				};

				// Use displayLoser for user notifications
				await this.notifyUser(displayLoser, client); // Make sure notifyUser can handle DisplayBetNotificationLost
			}
		}
	}

	async notifyUser(betData: DisplayBetNotification, client: SapphireClient) {
		const { userId, betId, result, displayResult } = betData;

		const color: ColorResolvable = '#57f287';

		if ('profit' in result && 'displayProfit' in displayResult) {
			const {
				team,
				displayBetAmount,
				displayPayout,
				displayProfit,
				displayNewBalance,
				displayOldBalance,
			} = {
				...displayResult,
			};

			const embed = new EmbedBuilder()
				.setTitle('🎉 Bet Won! 🎉')
				.setColor(color)
				.addFields(
					{ name: '🎯 Team Selected', value: team, inline: true },
					{ name: '💰 Bet Amount', value: displayBetAmount, inline: true },
					{ name: '💫 Profit', value: displayProfit, inline: true },
					{ name: '🏆 Total Payout', value: displayPayout, inline: false },
					{
						name: '📊 Balance Update',
						value: `${displayOldBalance} → ${displayNewBalance}`,
						inline: false,
					},
				)
				.setTimestamp()
				.setFooter({
					text: `Pluto | Bet ID: ${betId}`,
				});

			try {
				await client.users.send(userId, {
					embeds: [embed],
				});
			} catch (err) {
				logClr({
					text: `Failed to DM ${userId} | Bet ID: ${betId}\nAccount Privacy issue, Bot blocked, or no longer in the server.`,
					color: 'red',
					status: 'error',
				});
			}
		} else if ('betAmount' in result) {
			const { team, displayBetAmount } = {
				team: result.team,
				displayBetAmount: displayResult.displayBetAmount,
			};

			const embed = new EmbedBuilder()
				.setTitle('❌ Bet Lost')
				.setColor('#ff6961')
				.addFields(
					{ name: '🎯 Team Selected', value: team, inline: true },
					{ name: '💸 Lost', value: displayBetAmount, inline: true },
				)
				.setTimestamp()
				.setFooter({
					text: `Pluto | Bet ID: ${betId}`,
				});

			try {
				await client.users.send(userId, {
					embeds: [embed],
				});
			} catch (err) {
				logClr({
					text: `Failed to DM ${userId} | Bet ID: ${betId}\nAccount Privacy issue, Bot blocked, or no longer in the server.`,
					color: 'red',
					status: 'error',
				});
			}
		}
	}
}
