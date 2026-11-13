import {
	type BadgeEmojiRegistry,
	getBadgeEmojiRegistry,
} from '../../lib/badges/badge-emoji-registry.js'
import { buildAchievementsView } from '../../lib/badges/badge-view.js'
import type { ProfileViewModel } from '../../lib/discord/builders/profile-views.js'
import type { AchievementsApiClient } from '../api/Khronos/achievements/achievements-wrapper.js'
import { loadAchievements, warn } from './load-achievements.js'

interface ProfileSource {
	getProfile(userId: string): Promise<{
		balance: number
		level: number
		tier: string
		/** Absent on a Khronos that predates the saved view. */
		profile_view?: unknown
	}>
}

export interface ProfileViewDeps {
	accounts: ProfileSource
	achievements: AchievementsApiClient
	emoji?: BadgeEmojiRegistry
}

export interface LoadedProfileView {
	model: ProfileViewModel
	/** The profile owner's saved view, unvalidated. */
	preference: unknown
}

/** Returns null when neither the account nor achievements could be loaded. */
export async function loadProfileViewData(
	deps: ProfileViewDeps,
	subject: { userId: string; displayName: string; avatarUrl: string | null },
): Promise<LoadedProfileView | null> {
	const [profile, dto] = await Promise.all([
		deps.accounts.getProfile(subject.userId).catch((error) => {
			warn('Profile lookup failed', subject.userId, error)
			return null
		}),
		loadAchievements(deps.achievements, subject.userId),
	])
	if (!profile && !dto) return null
	return {
		preference: profile?.profile_view,
		model: {
			...subject,
			balance: profile?.balance ?? null,
			level: profile?.level ?? null,
			tier: profile?.tier ?? null,
			stats: dto
				? {
						wins: dto.summary.wins,
						losses: dto.summary.losses,
						pushes: dto.summary.pushes,
						netProfit: dto.summary.net_profit,
					}
				: null,
			achievements: dto
				? buildAchievementsView(
						dto,
						deps.emoji ?? getBadgeEmojiRegistry(),
					)
				: null,
		},
	}
}
