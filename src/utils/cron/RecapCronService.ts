import { container } from '@sapphire/framework'
import { getISOWeek, getISOWeekYear } from 'date-fns'
import { ChannelType, type TextChannel } from 'discord.js'
import type RecapWrapper from '../api/Khronos/recap/recap-wrapper.js'
import type { WeeklyRecapResponse } from '../api/Khronos/recap/recap-wrapper.js'
import type { CacheManager } from '../cache/cache-manager.js'
import { buildWeeklyRecapEmbeds } from '../embeds/weekly-recap.embed.js'
import { logger } from '../logging/WinstonLogger.js'

const RECAP_DEDUP_TTL_SECONDS = 8 * 24 * 60 * 60

export interface RecapChannelResolver {
	getBettingChannel(guildId: string): Promise<TextChannel>
}

export interface RecapCronOptions {
	guildIds: string[]
	enabled?: boolean
	channelId?: string
	weekOffset?: number
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
): string {
	const { seasonYear, weekNumber } = resolveWeekIdentity(data, now)
	return `recap:posted:${guildId}:${seasonYear}:${weekNumber}`
}

/**
 * Pulls a weekly recap from Khronos and delivers one digest per configured
 * guild. The service owns idempotency and failure isolation; the scheduler
 * only decides when this method runs.
 */
export class RecapCronService {
	private readonly recapApi: Pick<RecapWrapper, 'getWeeklyRecap'>
	private readonly cache: Pick<CacheManager, 'get' | 'set'>
	private readonly channelResolver: RecapChannelResolver
	private readonly options: Required<
		Pick<RecapCronOptions, 'guildIds' | 'enabled' | 'weekOffset'>
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
		}
	}

	async runWeeklyRecap(now = new Date()): Promise<RecapRunResult> {
		const result: RecapRunResult = { posted: 0, skipped: 0, failed: 0 }

		if (!this.options.enabled) {
			await logger.info({
				message: 'weekly_recap_skipped',
				metadata: { reason: 'disabled' },
			})
			return result
		}

		for (const guildId of this.options.guildIds) {
			try {
				const recap = await this.recapApi.getWeeklyRecap(
					guildId,
					this.options.weekOffset,
				)
				const key = dedupKey(guildId, recap, now)

				if (await this.cache.get(key)) {
					result.skipped++
					await logger.info({
						message: 'weekly_recap_skipped',
						metadata: { reason: 'dedup', guild_id: guildId, key },
					})
					continue
				}

				const channel = await this.getRecapChannel(guildId)
				await channel.send({ embeds: buildWeeklyRecapEmbeds(recap) })
				await this.cache.set(key, true, RECAP_DEDUP_TTL_SECONDS)
				result.posted++

				await logger.info({
					message: 'weekly_recap_posted',
					metadata: {
						guild_id: guildId,
						week_number: recap.window.week_number,
						channel_id: channel.id,
					},
				})
			} catch (error) {
				result.failed++
				await logger.error({
					message: 'weekly_recap_skipped',
					metadata: {
						reason: 'error',
						guild_id: guildId,
						status: this.getErrorStatus(error),
						error:
							error instanceof Error
								? error.message
								: String(error),
					},
				})
			}
		}

		return result
	}

	private async getRecapChannel(guildId: string): Promise<TextChannel> {
		if (!this.options.channelId) {
			return await this.channelResolver.getBettingChannel(guildId)
		}

		const channel = await container.client.channels.fetch(
			this.options.channelId,
		)
		if (!channel || channel.type !== ChannelType.GuildText) {
			throw new Error(
				`Recap channel ${this.options.channelId} is missing or not a text channel`,
			)
		}
		if (channel.guild.id !== guildId) {
			throw new Error(
				`Recap channel ${this.options.channelId} does not belong to guild ${guildId}`,
			)
		}
		return channel
	}

	private getErrorStatus(error: unknown): number | undefined {
		if (!error || typeof error !== 'object') return undefined
		const response = (error as { response?: { status?: unknown } }).response
		return typeof response?.status === 'number'
			? response.status
			: undefined
	}
}
