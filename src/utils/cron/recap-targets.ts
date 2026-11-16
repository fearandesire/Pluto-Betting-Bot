import type RecapWrapper from '../api/Khronos/recap/recap-wrapper.js'
import { logger } from '../logging/WinstonLogger.js'
import type { RecapGuildTarget } from './RecapCronService.js'

/**
 * Guilds that enabled one leaderboard auto-post and have a channel. A failed
 * settings read rejects, so the caller can skip the run instead of treating an
 * outage as "everyone disabled".
 */
export async function resolveLeaderboardTargets(
	recapApi: Pick<RecapWrapper, 'getSettings'>,
	flag: 'weekly_leaderboard_enabled' | 'monthly_leaderboard_enabled',
): Promise<Array<{ guildId: string; channelId: string }>> {
	const rows = await recapApi.getSettings()
	return rows
		.filter((row) => row[flag] && row.channel_id)
		.map((row) => ({
			guildId: row.guild_id,
			channelId: row.channel_id as string,
		}))
}

/**
 * Khronos settings replace the RECAP_* environment defaults as soon as at
 * least one row exists. A guild without a row falls back only when Khronos has
 * no rows at all (or the settings read fails), so deleting a row restores the
 * environment path.
 */
export async function resolveRecapTargets(
	recapApi: Pick<RecapWrapper, 'getSettings'>,
	envGuildIds: string[],
	envChannelId: string | undefined,
	envNbaEnabled: boolean,
): Promise<{ targets: RecapGuildTarget[]; source: 'settings' | 'env' }> {
	try {
		const rows = await recapApi.getSettings()
		if (rows.length > 0) {
			return {
				source: 'settings',
				targets: rows
					.filter((row) => row.enabled && row.channel_id)
					.map((row) => ({
						guildId: row.guild_id,
						channelId: row.channel_id ?? undefined,
						nbaEnabled: row.nba_enabled,
					})),
			}
		}
	} catch (error) {
		await logger.warn({
			message: 'weekly_recap_settings_unavailable',
			metadata: {
				error: error instanceof Error ? error.message : String(error),
			},
		})
	}

	return {
		source: 'env',
		targets: envGuildIds.map((guildId) => ({
			guildId,
			channelId: envChannelId,
			nbaEnabled: envNbaEnabled,
		})),
	}
}
