import type {
	AchievementsApiClient,
	UserAchievementsDto,
} from '../api/Khronos/achievements/achievements-wrapper.js'
import { logger } from '../logging/WinstonLogger.js'
import { MAX_PROFILE_BADGES, type ProfileCardData } from './profile-card.js'

interface ProfileSource {
	getProfile(userId: string): Promise<{ level: number; tier: string }>
}

export interface ProfileCardDeps {
	accounts: ProfileSource
	achievements: AchievementsApiClient
}

const warn = (message: string, userId: string, error: unknown) =>
	logger.warn({ message, metadata: { source: 'profile', userId, error } })

/**
 * Evaluate so badges are fresh, fall back to a plain read, and settle for no
 * badges when both fail.
 */
async function loadAchievements(
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

/** Returns null when neither the XP profile nor achievements could be loaded. */
export async function loadProfileCardData(
	deps: ProfileCardDeps,
	userId: string,
	displayName: string,
): Promise<ProfileCardData | null> {
	const [profile, achievements] = await Promise.all([
		deps.accounts.getProfile(userId).catch((error) => {
			warn('XP profile lookup failed', userId, error)
			return null
		}),
		loadAchievements(deps.achievements, userId),
	])
	if (!profile && !achievements) return null
	return {
		displayName,
		tier: profile?.tier ?? null,
		level: profile?.level ?? null,
		summary: achievements?.summary ?? null,
		badges: (achievements?.earned ?? [])
			.slice(0, MAX_PROFILE_BADGES)
			.map((badge) => badge.name),
		earnedCount: achievements?.earned.length,
	}
}
