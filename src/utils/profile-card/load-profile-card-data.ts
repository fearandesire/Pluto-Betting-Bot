import {
	type BadgeEmojiRegistry,
	getBadgeEmojiRegistry,
} from '../../lib/badges/badge-emoji-registry.js'
import { buildAchievementsView } from '../../lib/badges/badge-view.js'
import { profileBadgeLine } from '../../lib/discord/builders/achievements.js'
import type { AchievementsApiClient } from '../api/Khronos/achievements/achievements-wrapper.js'
import { loadAchievements, warn } from './load-achievements.js'
import { MAX_PROFILE_BADGES, type ProfileCardData } from './profile-card.js'

interface ProfileSource {
	getProfile(userId: string): Promise<{ level: number; tier: string }>
}

export interface ProfileCardDeps {
	accounts: ProfileSource
	achievements: AchievementsApiClient
	emoji?: BadgeEmojiRegistry
}

export interface LoadedProfile {
	card: ProfileCardData
	/** Null when achievements could not be loaded. */
	badgeLine: string | null
}

/** Returns null when neither the XP profile nor achievements could be loaded. */
export async function loadProfileCardData(
	deps: ProfileCardDeps,
	userId: string,
	displayName: string,
): Promise<LoadedProfile | null> {
	const [profile, achievements] = await Promise.all([
		deps.accounts.getProfile(userId).catch((error) => {
			warn('XP profile lookup failed', userId, error)
			return null
		}),
		loadAchievements(deps.achievements, userId),
	])
	if (!profile && !achievements) return null
	const view = achievements
		? buildAchievementsView(
				achievements,
				deps.emoji ?? getBadgeEmojiRegistry(),
			)
		: null
	return {
		card: {
			displayName,
			tier: profile?.tier ?? null,
			level: profile?.level ?? null,
			summary: achievements?.summary ?? null,
			badges: (view?.earned ?? [])
				.slice(0, MAX_PROFILE_BADGES)
				.map((badge) => badge.label),
			earnedCount: view?.earned.length,
		},
		badgeLine: view ? profileBadgeLine(view, MAX_PROFILE_BADGES) : null,
	}
}
