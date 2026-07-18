import { createHash } from 'node:crypto'
// Import interfaces and potentially the Discord client type
import { container } from '@sapphire/framework'
import { EmbedBuilder, type Message } from 'discord.js'
import type {
	BigWinAnnouncementService,
	BigWinParlayInput,
	BigWinSingleBetInput,
} from '../../../../services/engagement/BigWinAnnouncementService.js'
import { logger } from '../../../logging/WinstonLogger.js'
import MoneyFormatter from '../../common/money-formatting/money-format.js'
import type {
	ParlayResultNotification,
	PropSettledNotification,
} from '../shared-payload-schemas.js'
import type {
	BetNotificationWon,
	DisplayBetNotification,
	DisplayBetNotificationLost,
	DisplayBetNotificationPush,
	DisplayBetNotificationWon,
	DisplayResultLost,
	DisplayResultPush,
	DisplayResultWon,
	NotifyBetUsers,
} from './notifications.interface.js'

function createDeliveryNonce(
	deliveryId: string,
	destinationIndex: number,
): string {
	return createHash('sha256')
		.update(`${deliveryId}:${destinationIndex}`)
		.digest('hex')
		.slice(0, 25)
}

export default class NotificationService {
	private bigWinAnnouncementService?: BigWinAnnouncementService

	constructor(bigWinAnnouncementService?: BigWinAnnouncementService) {
		this.bigWinAnnouncementService = bigWinAnnouncementService
	}

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
				await this.announceSingleBetWin(winner)
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
		await this.announceParlayWin(data)
	}

	/**
	 * Queue worker entrypoint. Unlike the legacy callback method, Discord
	 * failures propagate so BullMQ can retain and retry the destination.
	 */
	async deliverParlayResult(
		data: ParlayResultNotification,
		deliveryId?: string,
	): Promise<void> {
		const embeds = this.buildParlayEmbeds(data)
		await this.sendParlayEmbeds(
			data.user_id,
			data,
			embeds,
			true,
			deliveryId,
		)
		try {
			await this.announceParlayWin(data)
		} catch (error) {
			logger.warn({
				method: this.deliverParlayResult.name,
				event: 'parlay.notification.announcement_failed',
				parlay_id: data.parlay_id,
				error: error instanceof Error ? error.message : String(error),
			})
		}
	}

	/**
	 * Apply one Khronos prop settlement to every original Discord post in the
	 * posting ledger. A missing/deleted message is a delivery warning, not a
	 * failed settlement: Khronos has already committed the outcome and can
	 * safely retry the callback later.
	 */
	async processPropSettled(data: PropSettledNotification): Promise<void> {
		const processedMessages = new Set<string>()
		for (const reference of data.messages) {
			const messageKey = `${reference.guild_id}:${reference.channel_id}:${reference.message_id}`
			if (processedMessages.has(messageKey)) continue
			processedMessages.add(messageKey)
			try {
				await this.deliverPropSettlementMessage(data, reference)
			} catch (error) {
				logger.warn({
					method: this.processPropSettled.name,
					event: 'prop.notification.message_update_failed',
					message:
						'Unable to update original prop message after settlement',
					guild_id: reference.guild_id,
					channel_id: reference.channel_id,
					message_id: reference.message_id,
					outcome_uuid: data.outcome_uuid,
					error:
						error instanceof Error ? error.message : String(error),
				})
			}
		}
	}

	/** Deliver exactly one prop message, allowing the durable worker to retry it. */
	async deliverPropSettlementMessage(
		data: PropSettledNotification,
		reference: PropSettledNotification['messages'][number],
	): Promise<void> {
		const client = container.client
		if (!client) {
			throw new Error(
				'Discord client not available for prop settlement update',
			)
		}
		const channel = await client.channels.fetch(reference.channel_id)
		if (
			!channel ||
			!channel.isTextBased() ||
			!('guildId' in channel) ||
			channel.guildId !== reference.guild_id
		) {
			const error = new Error(
				`Channel ${reference.channel_id} is missing, not text-based, or belongs to another guild`,
			)
			Object.assign(error, { code: '10003' })
			throw error
		}

		const message = await channel.messages.fetch(reference.message_id)
		const updatedEmbeds = message.embeds.map((embed, index) =>
			index === 0
				? this.buildPropSettlementEmbed(message, data)
				: EmbedBuilder.from(embed),
		)
		if (updatedEmbeds.length === 0) {
			const error = new Error(
				'Original prop message has no embed to update',
			)
			Object.assign(error, { code: '10003' })
			throw error
		}
		await message.edit({ embeds: updatedEmbeds, components: [] })
	}

	private buildPropSettlementEmbed(
		message: Message,
		data: PropSettledNotification,
	): EmbedBuilder {
		const originalEmbed = message.embeds[0]
		if (!originalEmbed) {
			throw new Error('Original prop message has no embed to update')
		}

		const embed = EmbedBuilder.from(originalEmbed)
		const fields = [...(embed.data.fields ?? [])]
		const resultFieldName = '🎯 Result'
		const tallyFieldName = '📊 Prediction results'
		const resultField = {
			name: resultFieldName,
			value: this.formatPropResult(data),
			inline: false,
		}
		const tallyField = {
			name: tallyFieldName,
			value: this.formatPropTallies(data),
			inline: false,
		}

		const resultIndex = fields.findIndex(
			(field) => field.name === resultFieldName,
		)
		if (resultIndex === -1) fields.push(resultField)
		else fields[resultIndex] = resultField

		const tallyIndex = fields.findIndex(
			(field) => field.name === tallyFieldName,
		)
		if (tallyIndex === -1) fields.push(tallyField)
		else fields[tallyIndex] = tallyField

		return embed.setFields(fields)
	}

	private formatPropResult(data: PropSettledNotification): string {
		const iconByResult: Record<PropSettledNotification['result'], string> =
			{
				won: '✅',
				lost: '❌',
				push: '➖',
				void: '🚫',
			}
		const label =
			data.winning_side_display?.trim() ||
			(
				{
					won: 'Won',
					lost: 'Lost',
					push: 'Push',
					void: 'Voided',
				} satisfies Record<PropSettledNotification['result'], string>
			)[data.result]
		const actualValue =
			data.actual_value === null || data.actual_value === undefined
				? ''
				: ` — ${data.actual_value}`

		return `**Result: ${label} ${iconByResult[data.result]}${actualValue}**`
	}

	private formatPropTallies(data: PropSettledNotification): string {
		const { correct, incorrect, total } = data.tallies
		const percentage = total === 0 ? 0 : Math.round((correct / total) * 100)
		const predictorLabel = total === 1 ? 'predictor' : 'predictors'
		return `${percentage}% of ${total} ${predictorLabel} got it right (${correct} correct, ${incorrect} incorrect).`
	}

	private async announceParlayWin(
		data: ParlayResultNotification,
	): Promise<void> {
		if (data.kind !== 'won' || !data.guild_id) return

		const payout = data.actual_payout ?? data.payout
		if (payout === undefined) return

		const input: BigWinParlayInput = {
			parlayId: data.parlay_id,
			guildId: data.guild_id,
			userId: data.user_id,
			payout,
			stake: data.stake,
			combinedOddsAmerican: data.combined_odds_american,
			legs: data.legs.length,
		}
		const service = await this.getBigWinAnnouncementService()
		await service.announceParlayWin(input)
	}

	private async announceSingleBetWin(
		winner: BetNotificationWon,
	): Promise<void> {
		if (!winner.guildId || winner.betId === undefined) return

		const input: BigWinSingleBetInput = {
			betId: winner.betId,
			guildId: winner.guildId,
			userId: winner.userId,
			payout: winner.result.payout,
			betAmount: winner.result.betAmount,
			team: winner.result.team,
		}
		const service = await this.getBigWinAnnouncementService()
		await service.announceSingleBetWin(input)
	}

	private async getBigWinAnnouncementService(): Promise<BigWinAnnouncementService> {
		if (!this.bigWinAnnouncementService) {
			const module = await import(
				'../../../../services/engagement/BigWinAnnouncementService.js'
			)
			this.bigWinAnnouncementService = new module.default()
		}
		return this.bigWinAnnouncementService
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
		throwOnFailure = false,
		deliveryId?: string,
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
			if (throwOnFailure) throw new Error('Discord client not available')
			return
		}

		try {
			const user = await client.users.fetch(userId)
			for (const [index, embed] of embeds.entries()) {
				await user.send({
					embeds: [embed],
					...(deliveryId
						? {
								nonce: createDeliveryNonce(deliveryId, index),
								enforceNonce: true,
							}
						: {}),
				})
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
			if (throwOnFailure) throw error
		}
	}

	async notifyUser(betData: DisplayBetNotification) {
		const { userId, betId, result, displayResult } = betData
		const betIdLabel =
			betId === undefined ? 'Bet ID unavailable' : `Bet ID: ${betId}`

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
						text: `Pluto | ${betIdLabel}`,
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
						text: `Pluto | ${betIdLabel}`,
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
						text: `Pluto | ${betIdLabel}`,
					})

				await this.sendEmbed(userId, betId, embed)
				break
			}
		}
	}

	private async sendEmbed(
		userId: string,
		betId: number | undefined,
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
