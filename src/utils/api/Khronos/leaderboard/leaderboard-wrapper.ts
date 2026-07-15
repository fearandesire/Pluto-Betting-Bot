import type { LeaderboardControllerGetLeaderboardV1Request } from '@pluto-khronos/api-client'
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

const readField = (
	value: Record<string, unknown>,
	snakeCase: string,
	camelCase: string,
) =>
	Object.prototype.hasOwnProperty.call(value, snakeCase)
		? value[snakeCase]
		: value[camelCase]

const readRequiredNumber = (
	value: Record<string, unknown>,
	snakeCase: string,
	camelCase: string,
) => {
	const field = readField(value, snakeCase, camelCase)
	if (typeof field !== 'number' || !Number.isFinite(field)) {
		throw new Error(`Khronos returned an invalid leaderboard ${snakeCase}`)
	}
	return field
}

const readOptionalNumber = (
	value: Record<string, unknown>,
	snakeCase: string,
	camelCase: string,
) => {
	const field = readField(value, snakeCase, camelCase)
	if (field === undefined || field === null) return 0
	if (typeof field !== 'number' || !Number.isFinite(field)) {
		throw new Error(`Khronos returned an invalid leaderboard ${snakeCase}`)
	}
	return field
}

/**
 * Normalize the wire response without going through the generated client DTO.
 *
 * The installed Khronos client predates streak fields and its generated
 * deserializer drops unknown properties before this wrapper can see them.
 */
export function parseLeaderboardWithStreaks(
	payload: unknown,
): LeaderboardResponseWithStreaks {
	if (!payload || typeof payload !== 'object') {
		throw new Error('Khronos returned an invalid leaderboard payload')
	}

	const response = payload as Record<string, unknown>
	if (!Array.isArray(response.entries)) {
		throw new Error(
			'Khronos returned an invalid leaderboard entries payload',
		)
	}
	const totalUsers = readField(response, 'total_users', 'totalUsers')
	if (typeof totalUsers !== 'number' || !Number.isFinite(totalUsers)) {
		throw new Error('Khronos returned an invalid leaderboard total_users')
	}

	return {
		total_users: totalUsers,
		entries: response.entries.map((entry) => {
			if (!entry || typeof entry !== 'object') {
				throw new Error('Khronos returned an invalid leaderboard entry')
			}
			const value = entry as Record<string, unknown>
			const userId = readField(value, 'user_id', 'userId')
			if (typeof userId !== 'string') {
				throw new Error(
					'Khronos returned an invalid leaderboard user_id',
				)
			}
			const badgeTier = readField(value, 'badge_tier', 'badgeTier')
			if (
				badgeTier !== undefined &&
				badgeTier !== null &&
				badgeTier !== 3 &&
				badgeTier !== 5 &&
				badgeTier !== 10
			) {
				throw new Error(
					'Khronos returned an invalid leaderboard badge tier',
				)
			}

			return {
				...value,
				user_id: userId,
				total_predictions: readRequiredNumber(
					value,
					'total_predictions',
					'totalPredictions',
				),
				correct_predictions: readRequiredNumber(
					value,
					'correct_predictions',
					'correctPredictions',
				),
				incorrect_predictions: readRequiredNumber(
					value,
					'incorrect_predictions',
					'incorrectPredictions',
				),
				success_rate: readRequiredNumber(
					value,
					'success_rate',
					'successRate',
				),
				current_streak: readOptionalNumber(
					value,
					'current_streak',
					'currentStreak',
				),
				best_streak: readOptionalNumber(
					value,
					'best_streak',
					'bestStreak',
				),
				badge_tier: (badgeTier ?? null) as StreakBadgeTier,
			}
		}),
	}
}

export default class LeaderboardWrapper {
	private readonly khConfig: IKH_API_CONFIG = KH_API_CONFIG

	/**
	 * @summary Retrieve leaderboard data based upon provided data
	 * @param params - Leaderboard query parameters
	 * @returns Promise resolving to leaderboard data
	 */
	async getLeaderboard(
		params: LeaderboardControllerGetLeaderboardV1Request,
	): Promise<LeaderboardResponseWithStreaks> {
		const path = '/api/khronos/v1/leaderboard'
		const query = new URLSearchParams({ guild_id: params.guildId })
		const fetchApi = this.khConfig.fetchApi ?? fetch
		const response = await fetchApi(
			`${this.khConfig.basePath.replace(/\/$/, '')}${path}?${query.toString()}`,
			{
				method: 'GET',
				headers: {
					...this.khConfig.headers,
					Accept: 'application/json',
				},
			},
		)

		if (!response.ok) {
			throw new Error(
				`Khronos leaderboard request failed (${response.status})`,
			)
		}

		return parseLeaderboardWithStreaks(await response.json())
	}
}
