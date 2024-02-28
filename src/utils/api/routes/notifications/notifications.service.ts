// Import interfaces and potentially the Discord client type
import {
	BetNotification,
	NotifyBetUsers,
} from '../../common/interfaces/notifications.js'
import { SapphireClient } from '@sapphire/framework'

export default class NotificationService {
	private client: SapphireClient

	constructor(client: SapphireClient) {
		this.client = client // Use the passed-in client
	}

	async processBetResults(data: NotifyBetUsers): Promise<void> {
		// Process winners
		for (const winner of data.winners) {
			const message = this.createWinnerMessage(winner)
			await this.sendDM(winner.userId, message).catch((error) =>
				console.error(`Failed to send DM to ${winner.userId}:`, error),
			)
		}

		// Process losers
		for (const loser of data.losers) {
			const message = this.createLoserMessage(loser)
			await this.sendDM(loser.userId, message).catch((error) =>
				console.error(`Failed to send DM to ${loser.userId}:`, error),
			)
		}
	}

	private createWinnerMessage(notification: BetNotification): string {
		const { team, betAmount, payout, profit } = notification.result as any // Cast to 'any' to access specific fields for winners
		return `Congratulations! Your bet on "${team}" won! Bet Amount: ${betAmount}, Payout: ${payout}, Profit: ${profit}.`
	}

	private createLoserMessage(notification: BetNotification): string {
		const { team, betAmount } = notification.result as any // Cast to 'any' to access specific fields for losers
		return `Sorry, your bet on "${team}" lost. Bet Amount: ${betAmount}. Better luck next time!`
	}

	private async sendDM(userId: string, message: string): Promise<void> {
		// Assuming SapDiscClient has a method 'sendDM' to send a direct message
		const user = await this.client.users.fetch(userId)
		await user.send(message)
	}
}
