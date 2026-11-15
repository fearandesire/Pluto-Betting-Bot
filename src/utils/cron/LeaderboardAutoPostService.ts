import type { TextChannel } from 'discord.js'
import { leaderboardAutoPostPayload } from '../../lib/discord/builders/leaderboard-post.js'
import type LeaderboardWrapper from '../api/Khronos/leaderboard/leaderboard-wrapper.js'
import type { CacheManager } from '../cache/cache-manager.js'
import { logger } from '../logging/WinstonLogger.js'
import {
	claimDelivery,
	type DeliveryChannelResolver,
	getErrorStatus,
	persistDeliveryMarker,
	releaseDeliveryClaim,
	resolveDeliveryChannel,
} from './delivery.js'
import type { RecapRunResult } from './RecapCronService.js'

const WEEKLY_TTL_SECONDS = 8 * 24 * 60 * 60
const MONTHLY_TTL_SECONDS = 35 * 24 * 60 * 60
const EVENT = 'leaderboard_post'

export interface LeaderboardPostTarget {
	guildId: string
	channelId: string
}

export interface LeaderboardAutoPostOptions {
	targets: LeaderboardPostTarget[]
	period: 'week' | 'month'
	enabled?: boolean
}

function easternDate(now: Date): string {
	return new Intl.DateTimeFormat('en-CA', {
		timeZone: 'America/New_York',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
	}).format(now)
}

/** Stable key for the Eastern window the post belongs to. */
function windowKey(now: Date, period: 'week' | 'month'): string {
	const date = easternDate(now)
	return period === 'week' ? date : date.slice(0, 7)
}

/**
 * Posts the props prediction leaderboard for the current Eastern week or
 * calendar month. Guilds and channels come from `guild_recap_settings`; the
 * service never invents a destination, and a missing channel is skipped.
 */
export class LeaderboardAutoPostService {
	private readonly options: Required<
		Pick<LeaderboardAutoPostOptions, 'targets' | 'period' | 'enabled'>
	>

	constructor(
		private readonly leaderboardApi: Pick<
			LeaderboardWrapper,
			'getLeaderboard'
		>,
		private readonly cache: Pick<CacheManager, 'get' | 'set'>,
		private readonly channelResolver: DeliveryChannelResolver,
		options: LeaderboardAutoPostOptions,
	) {
		this.options = {
			targets: options.targets,
			period: options.period,
			enabled: options.enabled ?? true,
		}
	}

	async runWeeklyRecap(
		now = new Date(),
		allowProcessingReclaim = false,
	): Promise<RecapRunResult> {
		const result: RecapRunResult = { posted: 0, skipped: 0, failed: 0 }
		const { targets, period } = this.options
		if (!this.options.enabled || targets.length === 0) {
			await logger.info({
				message: 'leaderboard_post_skipped',
				metadata: {
					reason: this.options.enabled ? 'no_targets' : 'disabled',
					period,
				},
			})
			return result
		}

		for (const target of targets) {
			await this.runTarget(target, now, allowProcessingReclaim, result)
		}
		return result
	}

	private async runTarget(
		target: LeaderboardPostTarget,
		now: Date,
		allowProcessingReclaim: boolean,
		result: RecapRunResult,
	): Promise<void> {
		const { period } = this.options
		const key = `leaderboard:posted:${period}:${target.guildId}:${windowKey(now, period)}`
		try {
			const leaderboard = await this.leaderboardApi.getLeaderboard({
				guildId: target.guildId,
				period,
				type: 'props',
			})
			if (leaderboard.entries.length === 0) {
				result.skipped++
				await logger.info({
					message: 'leaderboard_post_skipped',
					metadata: {
						reason: 'no_predictions',
						guild_id: target.guildId,
						period,
					},
				})
				return
			}

			const claimed = await claimDelivery(
				this.cache,
				key,
				allowProcessingReclaim,
			)
			if (!claimed) {
				result.skipped++
				await logger.info({
					message: 'leaderboard_post_skipped',
					metadata: {
						reason: 'dedup',
						guild_id: target.guildId,
						period,
						key,
					},
				})
				return
			}

			let channel: TextChannel
			try {
				channel = await resolveDeliveryChannel(
					this.channelResolver,
					target.guildId,
					target.channelId,
					EVENT,
				)
				await channel.send(
					leaderboardAutoPostPayload(leaderboard.entries, period),
				)
			} catch (error) {
				await releaseDeliveryClaim(this.cache, key, EVENT)
				throw error
			}

			await persistDeliveryMarker(
				this.cache,
				key,
				period === 'week' ? WEEKLY_TTL_SECONDS : MONTHLY_TTL_SECONDS,
				EVENT,
				target.guildId,
			)
			result.posted++
			await logger.info({
				message: 'leaderboard_posted',
				metadata: {
					guild_id: target.guildId,
					channel_id: channel.id,
					period,
				},
			})
		} catch (error) {
			result.failed++
			await logger.error({
				message: 'leaderboard_post_skipped',
				metadata: {
					reason: 'error',
					guild_id: target.guildId,
					period,
					status: getErrorStatus(error),
					error:
						error instanceof Error ? error.message : String(error),
				},
			})
		}
	}
}
