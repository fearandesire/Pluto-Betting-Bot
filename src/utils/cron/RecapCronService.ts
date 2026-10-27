import { getISOWeek, getISOWeekYear } from 'date-fns'
import type { TextChannel } from 'discord.js'
import type RecapWrapper from '../api/Khronos/recap/recap-wrapper.js'
import type {
	RecapSport,
	WeeklyRecapResponse,
} from '../api/Khronos/recap/recap-wrapper.js'
import type { CacheManager } from '../cache/cache-manager.js'
import { buildWeeklyRecapEmbeds } from '../embeds/weekly-recap.embed.js'
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

const RECAP_DEDUP_TTL_SECONDS = 8 * 24 * 60 * 60
const RECAP_EVENT = 'weekly_recap'

export type RecapChannelResolver = DeliveryChannelResolver

export interface RecapCronOptions {
	guildIds: string[]
	enabled?: boolean
	channelId?: string
	weekOffset?: number
	/** Also post an NBA recap per guild (RECAP_NBA_ENABLED). */
	nbaEnabled?: boolean
}

export interface RecapRunResult {
	posted: number
	skipped: number
	failed: number
}

function resolveWeekIdentity(
	data: WeeklyRecapResponse,
	now: Date,
): { seasonYear: number; weekNumber: number } {
	const startDate = new Date(data.window.start_date)
	const fallbackDate = Number.isNaN(startDate.valueOf()) ? now : startDate
	return {
		seasonYear: data.window.season_year ?? getISOWeekYear(fallbackDate),
		weekNumber: data.window.week_number ?? getISOWeek(fallbackDate),
	}
}

function dedupKey(
	guildId: string,
	data: WeeklyRecapResponse,
	now: Date,
	sport: RecapSport,
): string {
	const { seasonYear, weekNumber } = resolveWeekIdentity(data, now)
	// The NFL key predates multi-sport recaps and must not change.
	const prefix = sport === 'nfl' ? 'recap:posted' : `recap:posted:${sport}`
	return `${prefix}:${guildId}:${seasonYear}:${weekNumber}`
}

function isEmptyWeek(data: WeeklyRecapResponse): boolean {
	return (
		data.total_predictions === 0 &&
		data.biggest_single_win === null &&
		data.biggest_parlay_win === null
	)
}

/**
 * Pulls a weekly recap from Khronos and delivers one digest per configured
 * guild and sport. The service owns idempotency and failure isolation; the
 * scheduler only decides when this method runs.
 */
export class RecapCronService {
	private readonly recapApi: Pick<RecapWrapper, 'getWeeklyRecap'>
	private readonly cache: DeliveryCache
	private readonly channelResolver: RecapChannelResolver
	private readonly options: Required<
		Pick<
			RecapCronOptions,
			'guildIds' | 'enabled' | 'weekOffset' | 'nbaEnabled'
		>
	> &
		Pick<RecapCronOptions, 'channelId'>

	constructor(
		recapApi: Pick<RecapWrapper, 'getWeeklyRecap'>,
		cache: Pick<CacheManager, 'get' | 'set'>,
		channelResolver: RecapChannelResolver,
		options: RecapCronOptions,
	) {
		this.recapApi = recapApi
		this.cache = cache
		this.channelResolver = channelResolver
		this.options = {
			guildIds: options.guildIds.filter(Boolean),
			enabled: options.enabled ?? true,
			channelId: options.channelId,
			weekOffset: options.weekOffset ?? -1,
			nbaEnabled: options.nbaEnabled ?? false,
		}
	}

	async runWeeklyRecap(
		now = new Date(),
		allowProcessingReclaim = false,
	): Promise<RecapRunResult> {
		const result: RecapRunResult = { posted: 0, skipped: 0, failed: 0 }

		if (!this.options.enabled) {
			await logger.info({
				message: 'weekly_recap_skipped',
				metadata: { reason: 'disabled' },
			})
			return result
		}

		for (const guildId of this.options.guildIds) {
			await this.runGuildRecap(
				guildId,
				'nfl',
				now,
				allowProcessingReclaim,
				result,
			)
			if (this.options.nbaEnabled) {
				await this.runGuildRecap(
					guildId,
					'nba',
					now,
					allowProcessingReclaim,
					result,
				)
			}
		}

		return result
	}

	private async runGuildRecap(
		guildId: string,
		sport: RecapSport,
		now: Date,
		allowProcessingReclaim: boolean,
		result: RecapRunResult,
	): Promise<void> {
		const sportMetadata = sport === 'nfl' ? {} : { sport }
		try {
			// NFL keeps the legacy request: the default sport needs no param.
			const recap =
				sport === 'nfl'
					? await this.recapApi.getWeeklyRecap(
							guildId,
							this.options.weekOffset,
						)
					: await this.recapApi.getWeeklyRecap(guildId, -1, sport)

			if (sport !== 'nfl' && isEmptyWeek(recap)) {
				result.skipped++
				await logger.info({
					message: 'weekly_recap_skipped',
					metadata: {
						reason: 'empty_week',
						guild_id: guildId,
						...sportMetadata,
					},
				})
				return
			}

			const key = dedupKey(guildId, recap, now, sport)
			const claimed = await claimDelivery(
				this.cache,
				key,
				allowProcessingReclaim,
			)
			if (!claimed) {
				result.skipped++
				await logger.info({
					message: 'weekly_recap_skipped',
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
					RECAP_EVENT,
				)
				await channel.send({
					embeds: buildWeeklyRecapEmbeds(recap, sport),
				})
			} catch (error) {
				await releaseDeliveryClaim(this.cache, key, RECAP_EVENT)
				throw error
			}
			await persistDeliveryMarker(
				this.cache,
				key,
				RECAP_DEDUP_TTL_SECONDS,
				RECAP_EVENT,
				guildId,
			)
			result.posted++

			await logger.info({
				message: 'weekly_recap_posted',
				metadata: {
					guild_id: guildId,
					week_number: recap.window.week_number,
					channel_id: channel.id,
					...sportMetadata,
				},
			})
		} catch (error) {
			result.failed++
			await logger.error({
				message: 'weekly_recap_skipped',
				metadata: {
					reason: 'error',
					guild_id: guildId,
					...sportMetadata,
					status: getErrorStatus(error),
					error: errorMessage(error),
				},
			})
		}
	}
}
