import { createHash, randomUUID } from 'node:crypto'
// Import interfaces and potentially the Discord client type
import { container } from '@sapphire/framework'
import {
	EmbedBuilder,
	type Message,
	type MessageCreateOptions,
	type SendableChannels,
} from 'discord.js'
import {
	betResultEmbed,
	parlayResultEmbeds,
	refundResultPayload,
} from '../../../../lib/discord/builders/notifications.js'
import {
	propCorrectionEmbed,
	propSettlementEmbed,
} from '../../../../lib/discord/builders/props.js'
import { isV2Message } from '../../../../lib/discord/v2/edit.js'
import { v2EditFlags } from '../../../../lib/discord/v2/kit.js'
import {
	disableSettledPropRow,
	settleV2BoardComponents,
	toComponentJsonList,
} from '../../../../lib/discord/v2/prop-settlement.js'
import type {
	BigWinAnnouncementService,
	BigWinParlayInput,
	BigWinSingleBetInput,
} from '../../../../services/engagement/BigWinAnnouncementService.js'
import { logger } from '../../../logging/WinstonLogger.js'
import MoneyFormatter from '../../common/money-formatting/money-format.js'
import type {
	H2hResultNotification,
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

	async deliverH2hResult(
		data: H2hResultNotification,
		deliveryId?: string,
	): Promise<void> {
		const formattedAmounts = await MoneyFormatter.formatAmounts({
			amount: data.stake,
			payout: data.payout,
			profit: data.profit,
		})
		const options = { throwOnFailure: true, deliveryId }

		if (data.result === 'won') {
			await this.notifyUser(
				{
					userId: data.user_id,
					betId: data.bet_id,
					guildId: data.guild_id,
					result: {
						outcome: 'won',
						team: data.team,
						betAmount: data.stake,
						payout: data.payout,
						profit: data.profit,
						oldBalance: data.old_balance,
						newBalance: data.new_balance,
					},
					displayResult: {
						outcome: 'won',
						team: data.team,
						betAmount: data.stake,
						displayBetAmount: formattedAmounts.betAmount,
						payout: data.payout,
						profit: data.profit,
						displayPayout: formattedAmounts.payout,
						displayProfit: formattedAmounts.profit,
						displayOldBalance:
							data.old_balance === undefined
								? 'Unavailable'
								: MoneyFormatter.toUSD(data.old_balance),
						displayNewBalance:
							data.new_balance === undefined
								? 'Unavailable'
								: MoneyFormatter.toUSD(data.new_balance),
					},
				},
				options,
			)
			return
		}

		await this.notifyUser(
			{
				userId: data.user_id,
				betId: data.bet_id,
				guildId: data.guild_id,
				result: {
					outcome: 'lost',
					team: data.team,
					betAmount: data.stake,
				},
				displayResult: {
					outcome: 'lost',
					team: data.team,
					betAmount: data.stake,
					displayBetAmount: formattedAmounts.betAmount,
				},
			},
			options,
		)
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
		let fatal: unknown
		for (const reference of data.messages) {
			const messageKey = `${reference.guild_id}:${reference.channel_id}:${reference.message_id}`
			if (processedMessages.has(messageKey)) continue
			processedMessages.add(messageKey)
			try {
				await this.deliverPropSettlementMessage(data, reference)
			} catch (error) {
				const code = (error as { code?: string } | undefined)?.code
				if (
					code === 'PROP_SETTLEMENT_BUSY' ||
					code === 'PROP_SETTLEMENT_ROW_MISSING'
				) {
					// Another delivery is editing this message, or the board no
					// longer carries this outcome's row. Keep going with the
					// rest, then fail the delivery so the caller retries instead
					// of reporting a settlement that did not land.
					fatal ??= error
					continue
				}
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
		if (fatal) throw fatal
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
		const lockKey = [
			'props:settlement-lock',
			reference.guild_id,
			reference.channel_id,
			reference.message_id,
		].join(':')
		const lockToken = randomUUID()
		const claimed = await this.claimPropSettlementLock(lockKey, lockToken)
		const lock =
			claimed === 'busy'
				? await this.waitForPropSettlementLock(lockKey, lockToken)
				: claimed
		if (lock !== 'acquired') {
			throw propSettlementBusy(
				lock === 'busy'
					? 'Prop settlement is already updating this message; retry later'
					: 'Prop settlement lock is unavailable; retry later',
			)
		}
		const renewal = this.startPropSettlementLease(lockKey, lockToken)
		try {
			await this.updatePropSettlementMessage(
				client,
				data,
				reference,
				() => this.assertPropSettlementLease(lockKey, lockToken),
			)
		} finally {
			clearInterval(renewal)
			await this.releasePropSettlementLock(lockKey, lockToken)
		}
	}

	private async updatePropSettlementMessage(
		client: NonNullable<typeof container.client>,
		data: PropSettledNotification,
		reference: PropSettledNotification['messages'][number],
		assertLease: () => Promise<void>,
	): Promise<void> {
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

		const message = await channel.messages.fetch({
			message: reference.message_id,
			force: true,
		})
		const components = toComponentJsonList(message.components)

		if (isV2Message(message)) {
			const settled = settleV2BoardComponents(components, data)
			if (!settled.touched) {
				throw propSettlementRowMissing(
					`Board ${reference.message_id} has no row for outcome ${data.outcome_uuid}`,
				)
			}
			await assertLease()
			await message.edit({
				components: settled.components as never,
				flags: v2EditFlags(),
			})
			await this.announcePropCorrection(channel, message, data)
			return
		}

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
		// Keep the other rows of a board alive; only the graded pair's row is
		// retired. A legacy single-pair post therefore keeps its disabled row.
		const settled = disableSettledPropRow(components, data.outcome_uuid)
		await assertLease()
		await message.edit({
			embeds: updatedEmbeds,
			components: settled.components as never,
		})
		await this.announcePropCorrection(channel, message, data)
	}

	/**
	 * A corrected result posts its own notice that names the grade it replaces,
	 * so a reader who saw the first result sees that it changed. The addressee
	 * message is still edited above: the board has to show the grade that counts.
	 *
	 * The post follows the edit because a failed post must fail the delivery and
	 * retry, and repeating the edit is harmless. The nonce keeps a retry of the
	 * same revision from posting the notice twice.
	 */
	private async announcePropCorrection(
		channel: SendableChannels,
		original: Message,
		data: PropSettledNotification,
	): Promise<void> {
		if (data.correction !== true) return
		const revision = data.revision ?? 0
		const nonce = createHash('sha256')
			.update(`${data.outcome_uuid}:${revision}:${original.id}`)
			.digest('hex')
			.slice(0, 18)
		const posted = await channel.send({
			embeds: [propCorrectionEmbed(data)],
			reply: { messageReference: original.id, failIfNotExists: false },
			nonce: `pcorr:${nonce}`,
			enforceNonce: true,
			allowedMentions: { repliedUser: false },
		})
		logger.info({
			method: this.announcePropCorrection.name,
			event: 'prop.notification.correction_posted',
			message: 'Posted a prop correction notice',
			outcome_uuid: data.outcome_uuid,
			revision,
			supersedes_result: data.supersedes_result,
			result: data.result,
			guild_id: original.guildId ?? undefined,
			channel_id: original.channelId ?? undefined,
			original_message_id: original.id,
			correction_message_id: posted.id,
		})
	}

	/**
	 * One editor per message. Two settlements for the same board must apply in
	 * sequence; both fetch the message, so without a lock the second write can
	 * erase the first result. Without the lock nothing is edited; the delivery
	 * fails and the queue retries it.
	 */
	private async claimPropSettlementLock(
		key: string,
		token: string,
	): Promise<'acquired' | 'busy' | 'unavailable'> {
		try {
			const { default: redisCache } = await import(
				'../../../cache/redis-instance.js'
			)
			const result = await redisCache.set(key, token, 'EX', 60, 'NX')
			return result === 'OK' ? 'acquired' : 'busy'
		} catch (error) {
			logger.warn({
				method: 'claimPropSettlementLock',
				event: 'prop.settlement.lock_unavailable',
				key,
				error: error instanceof Error ? error.message : String(error),
			})
			return 'unavailable'
		}
	}

	/**
	 * A board's outcomes settle within moments of each other, so a busy lock is
	 * the normal case rather than a failure. Wait for the holder with jittered
	 * polls instead of spending a queue attempt on a one-minute backoff, where
	 * every loser would come back together and collide again.
	 */
	private async waitForPropSettlementLock(
		key: string,
		token: string,
	): Promise<'acquired' | 'busy' | 'unavailable'> {
		const deadline = Date.now() + PROP_SETTLEMENT_LOCK_WAIT_MS
		while (Date.now() < deadline) {
			const delay =
				PROP_SETTLEMENT_LOCK_POLL_MIN_MS +
				Math.floor(
					Math.random() *
						(PROP_SETTLEMENT_LOCK_POLL_MAX_MS -
							PROP_SETTLEMENT_LOCK_POLL_MIN_MS),
				)
			await new Promise((resolve) => setTimeout(resolve, delay))
			const attempt = await this.claimPropSettlementLock(key, token)
			if (attempt !== 'busy') return attempt
		}
		return 'busy'
	}

	/**
	 * Discord rate-limit waits can outlive the initial lease. Renew while the
	 * fetch-and-edit is in flight so a slow edit never loses the message.
	 */
	private startPropSettlementLease(
		key: string,
		token: string,
	): ReturnType<typeof setInterval> {
		const timer = setInterval(() => {
			void this.renewPropSettlementLease(key, token)
		}, 20_000)
		timer.unref?.()
		return timer
	}

	private async renewPropSettlementLease(
		key: string,
		token: string,
	): Promise<void> {
		try {
			const { default: redisCache } = await import(
				'../../../cache/redis-instance.js'
			)
			const renewed = await redisCache.refreshIfOwned(key, token, 60)
			if (!renewed) {
				logger.warn({
					method: 'renewPropSettlementLease',
					event: 'prop.settlement.lock_lost',
					key,
				})
			}
		} catch (error) {
			logger.warn({
				method: 'renewPropSettlementLease',
				event: 'prop.settlement.lock_renewal_failed',
				key,
				error: error instanceof Error ? error.message : String(error),
			})
		}
	}

	/**
	 * Confirm and extend ownership right before an edit, so a delivery whose
	 * lease expired never overwrites the holder's snapshot.
	 */
	private async assertPropSettlementLease(
		key: string,
		token: string,
	): Promise<void> {
		const { default: redisCache } = await import(
			'../../../cache/redis-instance.js'
		)
		const owned = await redisCache.refreshIfOwned(key, token, 60)
		if (!owned) {
			throw propSettlementBusy(
				'Prop settlement lost the message lock before editing; retry later',
			)
		}
	}

	private async releasePropSettlementLock(
		key: string,
		token: string,
	): Promise<void> {
		try {
			const { default: redisCache } = await import(
				'../../../cache/redis-instance.js'
			)
			// Only remove the lock while it still holds our token and has not
			// expired and been re-acquired by another delivery.
			if (typeof redisCache.compareAndRemove === 'function') {
				await redisCache.compareAndRemove(key, token)
				return
			}
			await redisCache.del(key)
		} catch (error) {
			logger.warn({
				method: 'releasePropSettlementLock',
				event: 'prop.settlement.lock_release_failed',
				key,
				error: error instanceof Error ? error.message : String(error),
			})
		}
	}

	private buildPropSettlementEmbed(
		message: Message,
		data: PropSettledNotification,
	): EmbedBuilder {
		const originalEmbed = message.embeds[0]
		if (!originalEmbed) {
			throw new Error('Original prop message has no embed to update')
		}
		return propSettlementEmbed(originalEmbed, data)
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
		return parlayResultEmbeds(data)
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

	async notifyUser(
		betData: DisplayBetNotification,
		options?: { throwOnFailure?: boolean; deliveryId?: string },
	) {
		const { userId, betId } = betData
		if (betData.result.outcome === 'push') {
			await this.sendEmbed(
				userId,
				betId,
				refundResultPayload(betData as DisplayBetNotificationPush),
				options,
			)
			return
		}
		const embed = betResultEmbed(betData)
		if (embed)
			await this.sendEmbed(userId, betId, { embeds: [embed] }, options)
	}

	private async sendEmbed(
		userId: string,
		betId: number | undefined,
		message: MessageCreateOptions,
		options?: { throwOnFailure?: boolean; deliveryId?: string },
	): Promise<void> {
		const client = container.client

		if (!client) {
			logger.error({
				method: this.sendEmbed.name,
				message: 'Discord client not available',
				userId,
				betId,
			})
			if (options?.throwOnFailure)
				throw new Error('Discord client not available')
			return
		}

		try {
			const user = options?.throwOnFailure
				? await client.users.fetch(userId)
				: undefined
			if (user) {
				await user.send({
					...message,
					nonce: options?.deliveryId
						? createDeliveryNonce(options.deliveryId, 0)
						: undefined,
					enforceNonce: Boolean(options?.deliveryId),
				})
			} else {
				await client.users.send(userId, message)
			}
		} catch (err) {
			logger.error({
				message: 'Unable to send Discord embed',
				userId,
				betId,
				error: err instanceof Error ? err.message : String(err),
				stack: err instanceof Error ? err.stack : undefined,
				method: this.sendEmbed.name,
			})
			if (options?.throwOnFailure) throw err
		}
	}
}

function propSettlementBusy(message: string): Error {
	return Object.assign(new Error(message), { code: 'PROP_SETTLEMENT_BUSY' })
}

function propSettlementRowMissing(message: string): Error {
	return Object.assign(new Error(message), {
		code: 'PROP_SETTLEMENT_ROW_MISSING',
	})
}

/** Long enough for a board's outcomes to queue behind one editor, short enough
 * to stay far under the worker's one-minute job lock. */
const PROP_SETTLEMENT_LOCK_WAIT_MS = 20_000
const PROP_SETTLEMENT_LOCK_POLL_MIN_MS = 120
const PROP_SETTLEMENT_LOCK_POLL_MAX_MS = 320
