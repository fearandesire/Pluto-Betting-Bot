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
import type { ParlayResultNotification } from './parlay-notification-contract.js'

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
				if (!winner.result.oldBalance || !winner.result.newBalance) {
					logger.error({
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

	/**
	 * Deliver one multi-leg parlay resolution to its owner.
	 *
	 * Discord delivery failures are intentionally swallowed after structured
	 * logging, matching the singles notification route's no-retry-storm
	 * behavior. Khronos still receives a successful HTTP response when Discord
	 * is unavailable.
	 */
	async processParlayResult(data: ParlayResultNotification): Promise<void> {
		const embeds = this.buildParlayEmbeds(data)
		await this.sendParlayEmbeds(data.user_id, data, embeds)
	}

	private buildParlayEmbeds(data: ParlayResultNotification): EmbedBuilder[] {
		const combinedOdds = this.formatAmericanOdds(
			data.combined_odds_american,
		)

		const baseEmbed = new EmbedBuilder()
			.setTimestamp()
			.setFooter({ text: `Pluto | Parlay ID: ${data.parlay_id}` })
			.addFields({
				name: '📈 Combined Odds',
				value: combinedOdds,
				inline: true,
			})

		switch (data.kind) {
			case 'won': {
				baseEmbed
					.setTitle('🎉 Parlay Won! 🎉')
					.setColor('#57f287')
					.addFields(
						{
							name: '💰 Stake',
							value: MoneyFormatter.toUSD(data.stake),
							inline: true,
						},
						{
							name: '🏆 Payout',
							value: MoneyFormatter.toUSD(
								data.actual_payout ?? data.payout ?? 0,
							),
							inline: true,
						},
					)
				if (
					data.old_balance !== undefined &&
					data.new_balance !== undefined
				) {
					baseEmbed.addFields({
						name: '📊 Balance Update',
						value: `${MoneyFormatter.toUSD(data.old_balance)} → ${MoneyFormatter.toUSD(data.new_balance)}`,
						inline: false,
					})
				}
				break
			}
			case 'busted':
			case 'lost':
				baseEmbed
					.setTitle('❌ Parlay Busted')
					.setColor('#ff6961')
					.addFields({
						name: '💸 Lost',
						value: MoneyFormatter.toUSD(data.stake),
						inline: true,
					})
				break
			case 'push_refunded':
				baseEmbed
					.setTitle('🔄 Parlay Refunded')
					.setColor('#ffa500')
					.addFields({
						name: '💵 Refunded Amount',
						value: MoneyFormatter.toUSD(
							data.refund_amount ??
								data.actual_payout ??
								data.stake,
						),
						inline: true,
					})
					.addFields({
						name: 'ℹ️ Reason',
						value: 'All eligible legs pushed or were voided. Your stake has been refunded.',
						inline: false,
					})
				break
		}

		const groups = this.buildParlayLegFieldGroups(data)
		if (groups.length === 0) return [baseEmbed]
		return groups.map((fields, index) => {
			const embed =
				index === 0
					? baseEmbed
					: new EmbedBuilder()
							.setTitle('🧾 Parlay Legs (continued)')
							.setTimestamp()
							.setFooter({
								text: `Pluto | Parlay ID: ${data.parlay_id}`,
							})
			embed.addFields(...fields)
			return embed
		})
	}

	private buildParlayLegFieldGroups(
		data: ParlayResultNotification,
	): Array<Array<{ name: string; value: string; inline: false }>> {
		const maxFieldLength = 800
		const maxFieldsPerEmbed = 20
		const maxLegCharactersPerEmbed = 4500
		const groups: Array<
			Array<{ name: string; value: string; inline: false }>
		> = []
		let currentGroup: Array<{
			name: string
			value: string
			inline: false
		}> = []
		let currentLines: string[] = []
		let currentFieldLength = 0
		let currentGroupLength = 0

		const flushField = () => {
			if (currentLines.length === 0) return
			currentGroup.push({
				name:
					currentGroup.length === 0
						? '🧾 Legs'
						: `🧾 Legs (${currentGroup.length + 1})`,
				value: currentLines.join('\n'),
				inline: false,
			})
			currentLines = []
			currentFieldLength = 0
		}
		const flushGroup = () => {
			flushField()
			if (currentGroup.length === 0) return
			groups.push(currentGroup)
			currentGroup = []
			currentGroupLength = 0
		}

		for (const leg of data.legs) {
			const selection = leg.selection_display
			const shortenedSelection =
				selection.length > 350
					? `${selection.slice(0, 349)}…`
					: selection
			const line = `${this.parlayLegGlyph(leg.result)} ${shortenedSelection} (${this.formatAmericanOdds(leg.odds_american)})`
			if (
				currentLines.length > 0 &&
				currentFieldLength + line.length + 1 > maxFieldLength
			) {
				flushField()
			}
			if (
				currentGroup.length >= maxFieldsPerEmbed ||
				(currentGroupLength > 0 &&
					currentGroupLength + line.length + 1 >
						maxLegCharactersPerEmbed)
			) {
				flushGroup()
			}
			currentLines.push(line)
			currentFieldLength += line.length + 1
			currentGroupLength += line.length + 1
		}
		flushGroup()

		return groups
	}

	private parlayLegGlyph(
		result: ParlayResultNotification['legs'][number]['result'],
	): string {
		switch (result) {
			case 'won':
				return '✅'
			case 'lost':
				return '❌'
			case 'pending':
				return '⏳'
			case 'push':
			case 'void':
				return '➖'
		}
	}

	private formatAmericanOdds(odds: number): string {
		return odds > 0 ? `+${odds}` : `${odds}`
	}

	private async sendParlayEmbeds(
		userId: string,
		data: ParlayResultNotification,
		embeds: EmbedBuilder[],
	): Promise<void> {
		const client = container.client

		if (!client) {
			logger.error({
				method: this.sendParlayEmbeds.name,
				event: 'parlay.notification.delivery_failed',
				message: 'Discord client not available for parlay notification',
				critical: true,
				kind: data.kind,
				parlay_id: data.parlay_id,
				user_id: userId,
			})
			return
		}

		try {
			const user = await client.users.fetch(userId)
			for (const embed of embeds) {
				await user.send({ embeds: [embed] })
			}
		} catch (error) {
			logger.error({
				method: this.sendParlayEmbeds.name,
				event: 'parlay.notification.delivery_failed',
				message: 'Unable to send parlay result Discord DM',
				critical: true,
				kind: data.kind,
				parlay_id: data.parlay_id,
				user_id: userId,
				error: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
			})
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
