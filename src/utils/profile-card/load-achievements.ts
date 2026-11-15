import {
	type BadgeEmojiRegistry,
	getBadgeEmojiRegistry,
} from '../../lib/badges/badge-emoji-registry.js'
import {
	type AchievementsView,
	buildAchievementsView,
} from '../../lib/badges/badge-view.js'
import type {
	AchievementsApiClient,
	UserAchievementsDto,
} from '../api/Khronos/achievements/achievements-wrapper.js'
import { logger } from '../logging/WinstonLogger.js'

export const warn = (message: string, userId: string, error: unknown) =>
	logger.warn({ message, metadata: { source: 'profile', userId, error } })

/**
 * Evaluate so badges are fresh, fall back to a plain read, and settle for no
 * badges when both fail.
 */
export async function loadAchievements(
	api: AchievementsApiClient,
	userId: string,
): Promise<UserAchievementsDto | null> {
	try {
		return await api.evaluateUserAchievements(userId)
	} catch (error) {
		warn('Achievement evaluate failed; falling back to read', userId, error)
	}
	try {
		return await api.getUserAchievements(userId)
	} catch (error) {
		warn('Achievement read failed; rendering without badges', userId, error)
		return null
	}
}

export async function loadAchievementsView(
	api: AchievementsApiClient,
	userId: string,
	registry: BadgeEmojiRegistry = getBadgeEmojiRegistry(),
): Promise<AchievementsView | null> {
	const dto = await loadAchievements(api, userId)
	return dto ? buildAchievementsView(dto, registry) : null
}
