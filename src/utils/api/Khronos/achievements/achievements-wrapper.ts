import * as KhronosApiClient from '@pluto-khronos/api-client'
import pTimeout from 'p-timeout'
import { KH_API_CONFIG } from '../KhronosInstances.js'

const DEFAULT_TIMEOUT_MS = 15_000

/**
 * Achievements contract exposed by Khronos.
 *
 * Kept local until the generated client release containing AchievementsApi is
 * published. The runtime constructor is resolved from that generated client
 * so this module does not introduce a hand-written HTTP implementation.
 */
export interface EarnedAchievement {
	key: string
	name: string
	description: string
	awarded_at: string
}

export interface LockedAchievement {
	key: string
	name: string
	description: string
	progress: number
	target: number
}

export interface AchievementSummary {
	settled_bets: number
	wins: number
	losses: number
	pushes: number
	net_profit: number
	best_win_payout: number | null
	settled_predictions: number
	prediction_hit_rate: number | null
}

export interface UserAchievementsDto {
	user_id: string
	/** Newest first. */
	earned: EarnedAchievement[]
	locked: LockedAchievement[]
	summary: AchievementSummary
}

export interface AchievementsApiClient {
	evaluateUserAchievements(userId: string): Promise<UserAchievementsDto>
	getUserAchievements(userId: string): Promise<UserAchievementsDto>
}

interface GeneratedAchievementsApiClient {
	evaluateUserAchievements(request: {
		userId: string
	}): Promise<UserAchievementsDto>
	getUserAchievements(request: {
		userId: string
	}): Promise<UserAchievementsDto>
}

type AchievementsApiConstructor = new (
	config: typeof KH_API_CONFIG,
) => GeneratedAchievementsApiClient

const GeneratedAchievementsApi = (
	KhronosApiClient as unknown as {
		AchievementsApi?: AchievementsApiConstructor
	}
).AchievementsApi

/** True when the installed generated client ships `AchievementsApi`. */
export const isAchievementsApiAvailable = (): boolean =>
	Boolean(GeneratedAchievementsApi)

/**
 * Generated-client wrapper for Khronos achievements. Achievements are
 * cosmetic: no currency, no streaks.
 */
export default class AchievementsWrapper implements AchievementsApiClient {
	private readonly api: GeneratedAchievementsApiClient

	constructor(client?: AchievementsApiClient) {
		if (client) {
			this.api = {
				evaluateUserAchievements: ({ userId }) =>
					client.evaluateUserAchievements(userId),
				getUserAchievements: ({ userId }) =>
					client.getUserAchievements(userId),
			}
			return
		}

		if (!GeneratedAchievementsApi) {
			throw new Error(
				'Khronos AchievementsApi is unavailable; update @pluto-khronos/api-client to the achievements release before enabling /profile',
			)
		}

		this.api = new GeneratedAchievementsApi(KH_API_CONFIG)
	}

	/** Awards any newly earned achievements, then returns the full state. */
	async evaluateUserAchievements(
		userId: string,
	): Promise<UserAchievementsDto> {
		return await pTimeout(this.api.evaluateUserAchievements({ userId }), {
			milliseconds: DEFAULT_TIMEOUT_MS,
		})
	}

	/** Read-only view of the current achievements state. */
	async getUserAchievements(userId: string): Promise<UserAchievementsDto> {
		return await pTimeout(this.api.getUserAchievements({ userId }), {
			milliseconds: DEFAULT_TIMEOUT_MS,
		})
	}
}
