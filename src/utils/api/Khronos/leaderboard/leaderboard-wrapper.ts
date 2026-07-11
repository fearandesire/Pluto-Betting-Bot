import type { SimpleLeaderboardResponseDto } from '@pluto-khronos/api-client'
import {
	LeaderboardApi,
	type LeaderboardControllerGetLeaderboardV1Request,
} from '@pluto-khronos/api-client'
import type { StreakBadgeTier } from '../../../predictions/streak-display.js'
import { type IKH_API_CONFIG, KH_API_CONFIG } from '../KhronosInstances.js'

export type { StreakBadgeTier }

export interface LeaderboardEntryWithStreaks {
	user_id: string
	total_predictions: number
	correct_predictions: number
	incorrect_predictions: number
	success_rate: number
	current_streak: number
	best_streak: number
	badge_tier: StreakBadgeTier
}

export interface LeaderboardResponseWithStreaks {
	entries: LeaderboardEntryWithStreaks[]
	total_users: number
}

export default class LeaderboardWrapper {
	private leaderboardsApi: LeaderboardApi
	private readonly khConfig: IKH_API_CONFIG = KH_API_CONFIG

	constructor() {
		this.leaderboardsApi = new LeaderboardApi(this.khConfig)
	}

	/**
	 * @summary Retrieve leaderboard data based upon provided data
	 * @param params - Leaderboard query parameters
	 * @returns Promise resolving to leaderboard data
	 */
	async getLeaderboard(
		params: LeaderboardControllerGetLeaderboardV1Request,
	): Promise<LeaderboardResponseWithStreaks> {
		const response =
			(await this.leaderboardsApi.leaderboardControllerGetLeaderboardV1(
				params,
			)) as SimpleLeaderboardResponseDto & {
				entries: Array<
					SimpleLeaderboardResponseDto['entries'][number] &
						Partial<
							Pick<
								LeaderboardEntryWithStreaks,
								'current_streak' | 'best_streak' | 'badge_tier'
							>
						>
				>
			}
		const entries = response.entries as Array<
			SimpleLeaderboardResponseDto['entries'][number] &
				Partial<
					Pick<
						LeaderboardEntryWithStreaks,
						'current_streak' | 'best_streak' | 'badge_tier'
					>
				>
		>

		return {
			...response,
			entries: entries.map((entry) => ({
				...entry,
				current_streak: entry.current_streak ?? 0,
				best_streak: entry.best_streak ?? 0,
				badge_tier: entry.badge_tier ?? null,
			})),
		}
	}
}
