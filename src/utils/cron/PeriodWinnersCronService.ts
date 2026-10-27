import type { TextChannel } from 'discord.js'
import { periodWinnersPayload } from '../../lib/discord/builders/period-winners.js'
import type RecapWrapper from '../api/Khronos/recap/recap-wrapper.js'
import type {
	RecapSport,
	WinnersPeriod,
} from '../api/Khronos/recap/recap-wrapper.js'
import type { CacheManager } from '../cache/cache-manager.js'
import { logger } from '../logging/WinstonLogger.js'
import {
	claimDelivery,
	type DeliveryCache,
	type DeliveryChannelResolver,
	errorMessage,
	getErrorStatus,
	persistDeliveryMarker,
	releaseDeliveryClaim,
	resolveDeliveryChannel,
} from './delivery.js'
import type { RecapRunResult } from './RecapCronService.js'

// Longest period posted is monthly; keep the marker well past the next run.
const WINNERS_DEDUP_TTL_SECONDS = 35 * 24 * 60 * 60
const WINNERS_EVENT = 'period_winners'

export interface PeriodWinnersCronOptions {
	guildIds: string[]
	enabled?: boolean
	channelId?: string
	/** Sports to post for; the caller adds nba only when RECAP_NBA_ENABLED. */
	sports?: RecapSport[]
}

/**
 * Posts the winners of the closed previous period (`period_offset -1`) per
 * guild and sport. Same idempotency model as RecapCronService: a processing
 * claim, the Discord send, then a durable sent marker keyed by window start.
 */
export class PeriodWinnersCronService {
	private readonly recapApi: Pick<RecapWrapper, 'getPeriodWinners'>
	private readonly cache: DeliveryCache
	private readonly channelResolver: DeliveryChannelResolver
	private readonly options: Required<
		Pick<PeriodWinnersCronOptions, 'guildIds' | 'enabled' | 'sports'>
	> &
		Pick<PeriodWinnersCronOptions, 'channelId'>

	constructor(
		recapApi: Pick<RecapWrapper, 'getPeriodWinners'>,
		cache: Pick<CacheManager, 'get' | 'set'>,
		channelResolver: DeliveryChannelResolver,
		options: PeriodWinnersCronOptions,
	) {
		this.recapApi = recapApi
		this.cache = cache
		this.channelResolver = channelResolver
		this.options = {
			guildIds: options.guildIds.filter(Boolean),
			enabled: options.enabled ?? false,
			channelId: options.channelId,
			sports: options.sports ?? ['nfl'],
		}
	}

	async runPeriodWinners(
		period: WinnersPeriod,
		allowProcessingReclaim = false,
	): Promise<RecapRunResult> {
		const result: RecapRunResult = { posted: 0, skipped: 0, failed: 0 }

		if (!this.options.enabled) {
			await logger.info({
				message: 'period_winners_skipped',
				metadata: { reason: 'disabled', period },
			})
			return result
		}

		for (const guildId of this.options.guildIds) {
			for (const sport of this.options.sports) {
				await this.runGuildWinners(
					guildId,
					sport,
					period,
					allowProcessingReclaim,
					result,
				)
			}
		}

		return result
	}

	private async runGuildWinners(
		guildId: string,
		sport: RecapSport,
		period: WinnersPeriod,
		allowProcessingReclaim: boolean,
		result: RecapRunResult,
	): Promise<void> {
		try {
			const winners = await this.recapApi.getPeriodWinners({
				guildId,
				sport,
				period,
				periodOffset: -1,
			})

			if (winners.winners.length === 0) {
				result.skipped++
				await logger.info({
					message: 'period_winners_skipped',
					metadata: {
						reason: 'no_winners',
						guild_id: guildId,
						sport,
						period,
					},
				})
				return
			}

			const key = `winners:posted:${guildId}:${sport}:${period}:${winners.window.start_date}`
			const claimed = await claimDelivery(
				this.cache,
				key,
				allowProcessingReclaim,
			)
			if (!claimed) {
				result.skipped++
				await logger.info({
					message: 'period_winners_skipped',
					metadata: { reason: 'dedup', guild_id: guildId, key },
				})
				return
			}

			let channel: TextChannel
			try {
				channel = await resolveDeliveryChannel(
					this.channelResolver,
					guildId,
					this.options.channelId,
					WINNERS_EVENT,
				)
				await channel.send(periodWinnersPayload(winners))
			} catch (error) {
				await releaseDeliveryClaim(this.cache, key, WINNERS_EVENT)
				throw error
			}
			await persistDeliveryMarker(
				this.cache,
				key,
				WINNERS_DEDUP_TTL_SECONDS,
				WINNERS_EVENT,
				guildId,
			)
			result.posted++

			await logger.info({
				message: 'period_winners_posted',
				metadata: {
					guild_id: guildId,
					sport,
					period,
					channel_id: channel.id,
				},
			})
		} catch (error) {
			result.failed++
			await logger.error({
				message: 'period_winners_skipped',
				metadata: {
					reason: 'error',
					guild_id: guildId,
					sport,
					period,
					status: getErrorStatus(error),
					error: errorMessage(error),
				},
			})
		}
	}
}
