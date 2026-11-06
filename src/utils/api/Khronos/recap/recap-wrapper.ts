import * as KhronosApiClient from '@pluto-khronos/api-client'
import pTimeout from 'p-timeout'
import { KH_API_CONFIG } from '../KhronosInstances.js'

const DEFAULT_TIMEOUT_MS = 30_000

/**
 * Weekly recap contract exposed by Khronos TF-957.
 *
 * Kept local until the generated client release containing RecapApi is
 * published. The runtime constructor is resolved from that generated client
 * so this module does not introduce a hand-written HTTP implementation.
 */
export type RecapSport = 'nfl' | 'nba'
export type WinnersPeriod = 'weekly' | 'monthly' | 'season'

export interface WeeklyRecapResponse {
	window: {
		start_date: string
		end_date: string
		week_number?: number
		season_year?: number
		/** Echoed by Khronos when a sport was requested. */
		sport?: RecapSport
	}
	total_predictions: number
	correct_predictions: number
	incorrect_predictions: number
	accuracy: number
	accuracy_delta: number
	top_predictors: Array<{
		user_id: string
		correct_predictions: number
		incorrect_predictions: number
		success_rate: number
		display_name?: string
	}>
	biggest_single_win: {
		user_id: string
		payout: number
		bet_id?: number
		parlay_id?: string
	} | null
	biggest_parlay_win: {
		user_id: string
		payout: number
		bet_id?: number
		parlay_id?: string
	} | null
}

export interface WeeklyRecapRequest {
	guildId: string
	weekOffset?: number
	sport?: RecapSport
}

export interface PeriodWinner {
	user_id: string
	rank: number
	net_profit: number
	roi: number | null
	settled_bets: number
	total_staked: number
}

/** `winners` is empty when nobody profited; `leaderboard` holds the top 5. */
export interface PeriodWinnersResponse {
	sport: RecapSport
	period: WinnersPeriod
	window: {
		start_date: string
		end_date: string
		label: string
	}
	participants: number
	unresolved_events: number
	winners: PeriodWinner[]
	leaderboard: PeriodWinner[]
}

export interface PeriodWinnersRequest {
	guildId: string
	sport: RecapSport
	period: WinnersPeriod
	periodOffset?: number
}

export interface RecapApiClient {
	getWeeklyRecap(
		guildId: string,
		weekOffset?: number,
		sport?: RecapSport,
	): Promise<WeeklyRecapResponse>
	getPeriodWinners?(
		request: PeriodWinnersRequest,
	): Promise<PeriodWinnersResponse>
}

interface GeneratedRecapApiClient {
	getWeeklyRecap(request: WeeklyRecapRequest): Promise<WeeklyRecapResponse>
	getPeriodWinners?(
		request: PeriodWinnersRequest,
	): Promise<PeriodWinnersResponse>
}

type RecapApiConstructor = new (
	config: typeof KH_API_CONFIG,
) => GeneratedRecapApiClient

const GeneratedRecapApi = (
	KhronosApiClient as unknown as { RecapApi?: RecapApiConstructor }
).RecapApi

/**
 * Generated-client wrapper for Khronos weekly recap data.
 */
export default class RecapWrapper implements RecapApiClient {
	private readonly recapApi: GeneratedRecapApiClient

	constructor(recapApi?: RecapApiClient) {
		if (recapApi) {
			this.recapApi = {
				getWeeklyRecap: (request) =>
					recapApi.getWeeklyRecap(
						request.guildId,
						request.weekOffset,
						request.sport,
					),
				getPeriodWinners: recapApi.getPeriodWinners?.bind(recapApi),
			}
			return
		}

		if (!GeneratedRecapApi) {
			throw new Error(
				'Khronos RecapApi is unavailable; update @pluto-khronos/api-client to the TF-957 release before enabling weekly recaps',
			)
		}

		this.recapApi = new GeneratedRecapApi(KH_API_CONFIG)
	}

	async getWeeklyRecap(
		guildId: string,
		weekOffset = -1,
		sport?: RecapSport,
	): Promise<WeeklyRecapResponse> {
		const recap = await pTimeout(
			this.recapApi.getWeeklyRecap(
				sport
					? { guildId, weekOffset, sport }
					: { guildId, weekOffset },
			),
			{ milliseconds: DEFAULT_TIMEOUT_MS },
		)
		// A generated client that predates the sport param drops it silently and
		// answers with the default sport. Fail closed instead of mislabelling.
		if (sport && recap.window.sport !== sport) {
			throw new Error(
				`Khronos recap returned sport ${recap.window.sport ?? 'unknown'} for requested sport ${sport}; update @pluto-khronos/api-client`,
			)
		}
		return recap
	}

	async getPeriodWinners(
		request: PeriodWinnersRequest,
	): Promise<PeriodWinnersResponse> {
		if (!this.recapApi.getPeriodWinners) {
			throw new Error(
				'Khronos RecapApi.getPeriodWinners is unavailable; update @pluto-khronos/api-client to the release with period winners before enabling PERIOD_WINNERS_ENABLED',
			)
		}
		const winners = await pTimeout(
			this.recapApi.getPeriodWinners(request),
			{
				milliseconds: DEFAULT_TIMEOUT_MS,
			},
		)
		if (
			winners.sport !== request.sport ||
			winners.period !== request.period
		) {
			throw new Error(
				`Khronos period winners returned ${winners.sport}/${winners.period} for requested ${request.sport}/${request.period}`,
			)
		}
		return winners
	}
}
