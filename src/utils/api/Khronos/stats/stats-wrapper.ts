import {
	type GetOverallH2hBettingStatsRequest,
	type OverallStatsDto,
	StatsApi,
} from '@pluto-khronos/api-client'
import { KH_API_CONFIG } from '../KhronosInstances.js'

export interface PredictionStats {
	user_id: string
	correct_predictions: number
	incorrect_predictions: number
	total_predictions: number
	success_rate: number
	current_streak: number
	best_streak: number
	badge_tier: 3 | 5 | 10 | null
}

export interface PredictionStatsRequest {
	userId: string
	guildId: string
}

/**
 * The generated client predates the F3 stats operation. Keep the temporary
 * transport shim here until the next Khronos package release adds it.
 */
export function parsePredictionStats(payload: unknown): PredictionStats {
	if (!payload || typeof payload !== 'object') {
		throw new Error('Khronos returned an invalid prediction stats payload')
	}

	const value = payload as Record<string, unknown>
	const numericFields = [
		'correct_predictions',
		'incorrect_predictions',
		'total_predictions',
		'success_rate',
		'current_streak',
		'best_streak',
	] as const
	if (
		typeof value.user_id !== 'string' ||
		numericFields.some(
			(field) =>
				typeof value[field] !== 'number' ||
				!Number.isFinite(value[field]),
		)
	) {
		throw new Error('Khronos returned an invalid prediction stats payload')
	}

	const badgeTier = value.badge_tier as PredictionStats['badge_tier']
	if (
		badgeTier !== null &&
		badgeTier !== 3 &&
		badgeTier !== 5 &&
		badgeTier !== 10
	) {
		throw new Error(
			'Khronos returned an invalid prediction stats badge tier',
		)
	}
	const correctPredictions = value.correct_predictions as number
	const incorrectPredictions = value.incorrect_predictions as number
	const totalPredictions = value.total_predictions as number
	const successRate = value.success_rate as number
	const currentStreak = value.current_streak as number
	const bestStreak = value.best_streak as number

	return {
		user_id: value.user_id,
		correct_predictions: correctPredictions,
		incorrect_predictions: incorrectPredictions,
		total_predictions: totalPredictions,
		success_rate: successRate,
		current_streak: currentStreak,
		best_streak: bestStreak,
		badge_tier: badgeTier,
	}
}

export default class StatsWrapper {
	private readonly statsApi: StatsApi

	constructor() {
		this.statsApi = new StatsApi(KH_API_CONFIG)
	}

	async getOverallStats(
		params: GetOverallH2hBettingStatsRequest,
	): Promise<OverallStatsDto> {
		const response = await this.statsApi.getOverallH2hBettingStats(params)
		return response
	}

	async getPredictionStats(
		params: PredictionStatsRequest,
	): Promise<PredictionStats> {
		const path = `/api/khronos/v1/prediction/stats/${encodeURIComponent(params.userId)}`
		const query = new URLSearchParams({ guild_id: params.guildId })
		const fetchApi = KH_API_CONFIG.fetchApi ?? fetch
		const response = await fetchApi(
			`${KH_API_CONFIG.basePath}${path}?${query.toString()}`,
			{
				method: 'GET',
				headers: {
					...KH_API_CONFIG.headers,
					Accept: 'application/json',
				},
			},
		)

		if (!response.ok) {
			throw new Error(
				`Khronos prediction stats request failed (${response.status})`,
			)
		}

		return parsePredictionStats(await response.json())
	}
}
