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
export interface WeeklyRecapResponse {
	window: {
		start_date: string
		end_date: string
		week_number?: number
		season_year?: number
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
}

export interface RecapApiClient {
	getWeeklyRecap(
		guildId: string,
		weekOffset?: number,
	): Promise<WeeklyRecapResponse>
}

interface GeneratedRecapApiClient {
	getWeeklyRecap(request: WeeklyRecapRequest): Promise<WeeklyRecapResponse>
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
					),
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
	): Promise<WeeklyRecapResponse> {
		return await pTimeout(
			this.recapApi.getWeeklyRecap({ guildId, weekOffset }),
			{ milliseconds: DEFAULT_TIMEOUT_MS },
		)
	}
}
