import { EmbedBuilder, type MessageCreateOptions } from 'discord.js'
import embedColors from '../../lib/colorsConfig.js'
import env from '../../lib/startup/env.js'
import MoneyFormatter from '../../utils/api/common/money-formatting/money-format.js'
import GuildWrapper from '../../utils/api/Khronos/guild/guild-wrapper.js'
import redisCache from '../../utils/cache/redis-instance.js'
import { logger } from '../../utils/logging/WinstonLogger.js'

export const BIG_WIN_ANNOUNCEMENT_MAX_PER_HOUR = 5
export const BIG_WIN_ANNOUNCEMENT_TTL_SECONDS = 60 * 60
export const BIG_WIN_ANNOUNCEMENT_DEDUP_TTL_SECONDS = 7 * 24 * 60 * 60
export const BIG_WIN_DEDUP_KEY_PREFIX = 'pluto:big-win-announcement:sent'
export const BIG_WIN_RATE_KEY_PREFIX = 'pluto:big-win-announcement:rate'

export interface BigWinAnnouncementRedis {
	set(
		key: string,
		value: string,
		...args: Array<string | number>
	): Promise<string | null>
	incr(key: string): Promise<number>
	decr(key: string): Promise<number>
	expire(key: string, seconds: number): Promise<number>
	del(key: string): Promise<number>
}

export interface BigWinAnnouncementSender {
	sendToBettingChannel(
		guildId: string,
		options: MessageCreateOptions,
	): Promise<unknown>
}

export interface BigWinParlayInput {
	parlayId: string
	guildId: string
	userId: string
	payout: number
	stake: number
	combinedOddsAmerican: number
	legs: number
}

export interface BigWinSingleBetInput {
	betId: string | number
	guildId: string
	userId: string
	payout: number
	betAmount: number
	team: string
	oddsAmerican?: number
}

type AnnouncementKind = 'parlay' | 'bet'

interface AnnouncementInput {
	kind: AnnouncementKind
	id: string | number
	guildId: string
	userId: string
	payout: number
	buildEmbed: () => EmbedBuilder
}

function getAnnouncementThreshold(): number {
	const configured = Number(env.ANNOUNCE_PAYOUT_THRESHOLD)
	return Number.isFinite(configured) && configured >= 0 ? configured : 100
}

/**
 * Delivers high-value wins to a guild's betting channel.
 *
 * Redis reserves the event before Discord delivery. This makes duplicate
 * Khronos callbacks safe even when Pluto processes them concurrently. The
 * per-guild counter is a rolling one-hour window shared by all Pluto replicas.
 */
export class BigWinAnnouncementService {
	constructor(
		private readonly redis: BigWinAnnouncementRedis = redisCache as unknown as BigWinAnnouncementRedis,
		private readonly sender: BigWinAnnouncementSender = new GuildWrapper(),
		private readonly threshold = getAnnouncementThreshold(),
		private readonly maxPerHour = env.ANNOUNCE_MAX_PER_HOUR ??
			BIG_WIN_ANNOUNCEMENT_MAX_PER_HOUR,
		private readonly enabled = env.BIG_WIN_ANNOUNCEMENTS_ENABLED ?? true,
	) {}

	async announceParlayWin(input: BigWinParlayInput): Promise<boolean> {
		return this.announce({
			kind: 'parlay',
			id: input.parlayId,
			guildId: input.guildId,
			userId: input.userId,
			payout: input.payout,
			buildEmbed: () =>
				new EmbedBuilder()
					.setTitle('💰 Big Parlay Win! 💰')
					.setDescription(
						`<@${input.userId}> just hit a huge parlay!`,
					)
					.setColor(embedColors.success)
					.addFields(
						{
							name: '🧾 Legs',
							value: String(input.legs),
							inline: true,
						},
						{
							name: '📈 Combined Odds',
							value: this.formatOdds(input.combinedOddsAmerican),
							inline: true,
						},
						{
							name: '🏆 Payout',
							value: MoneyFormatter.toUSD(input.payout),
							inline: false,
						},
					)
					.setFooter({ text: `Parlay ID: ${input.parlayId}` })
					.setTimestamp(),
		})
	}

	async announceSingleBetWin(input: BigWinSingleBetInput): Promise<boolean> {
		return this.announce({
			kind: 'bet',
			id: input.betId,
			guildId: input.guildId,
			userId: input.userId,
			payout: input.payout,
			buildEmbed: () =>
				new EmbedBuilder()
					.setTitle('💰 Big Win! 💰')
					.setDescription(`<@${input.userId}> just landed a big win!`)
					.setColor(embedColors.success)
					.addFields(
						{
							name: '🎯 Selection',
							value: input.team,
							inline: true,
						},
						...(input.oddsAmerican === undefined
							? []
							: [
									{
										name: '📈 Odds',
										value: this.formatOdds(
											input.oddsAmerican,
										),
										inline: true,
									},
								]),
						{
							name: '🏆 Payout',
							value: MoneyFormatter.toUSD(input.payout),
							inline: false,
						},
					)
					.setFooter({ text: `Bet ID: ${input.betId}` })
					.setTimestamp(),
		})
	}

	private async announce(input: AnnouncementInput): Promise<boolean> {
		if (
			!this.enabled ||
			!Number.isFinite(input.payout) ||
			input.payout < this.threshold
		) {
			return false
		}

		const dedupKey = `${BIG_WIN_DEDUP_KEY_PREFIX}:${input.kind}:${input.id}`
		const rateKey = `${BIG_WIN_RATE_KEY_PREFIX}:${input.guildId}`
		let rateCounted = false

		try {
			const reserved = await this.redis.set(
				dedupKey,
				'1',
				'EX',
				BIG_WIN_ANNOUNCEMENT_DEDUP_TTL_SECONDS,
				'NX',
			)
			if (reserved !== 'OK') return false

			const count = await this.redis.incr(rateKey)
			rateCounted = true
			if (count === 1) {
				try {
					await this.redis.expire(
						rateKey,
						BIG_WIN_ANNOUNCEMENT_TTL_SECONDS,
					)
				} catch (error) {
					await this.compensateRateCounter(rateKey)
					await this.releaseReservation(dedupKey)
					logger.error({
						event: 'big_win.announcement_rate_expiry_failed',
						guild_id: input.guildId,
						error:
							error instanceof Error
								? error.message
								: String(error),
					})
					return false
				}
			}
			if (count > this.maxPerHour) {
				await this.releaseReservation(dedupKey)
				logger.info({
					event: 'big_win.announcement_rate_limited',
					guild_id: input.guildId,
					kind: input.kind,
					id: input.id,
					count,
					max_per_hour: this.maxPerHour,
				})
				return false
			}

			await this.sender.sendToBettingChannel(input.guildId, {
				embeds: [input.buildEmbed()],
			})
			return true
		} catch (error) {
			await this.releaseReservation(dedupKey)
			if (rateCounted) {
				await this.compensateRateCounter(rateKey)
			}
			logger.error({
				event: 'big_win.announcement_failed',
				guild_id: input.guildId,
				kind: input.kind,
				id: input.id,
				payout: input.payout,
				error: error instanceof Error ? error.message : String(error),
			})
			return false
		}
	}

	private async releaseReservation(dedupKey: string): Promise<void> {
		try {
			await this.redis.del(dedupKey)
		} catch (error) {
			logger.warn({
				event: 'big_win.announcement_reservation_cleanup_failed',
				dedup_key: dedupKey,
				error: error instanceof Error ? error.message : String(error),
			})
		}
	}

	private async compensateRateCounter(rateKey: string): Promise<void> {
		try {
			const remaining = await this.redis.decr(rateKey)
			if (remaining <= 0) {
				await this.redis.del(rateKey)
			} else {
				await this.redis.expire(
					rateKey,
					BIG_WIN_ANNOUNCEMENT_TTL_SECONDS,
				)
			}
		} catch (error) {
			logger.warn({
				event: 'big_win.announcement_rate_cleanup_failed',
				rate_key: rateKey,
				error: error instanceof Error ? error.message : String(error),
			})
		}
	}

	private formatOdds(odds: number): string {
		return odds > 0 ? `+${odds}` : String(odds)
	}
}

export default BigWinAnnouncementService
