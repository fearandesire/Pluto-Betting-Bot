import type { AxiosRequestConfig } from 'axios'
import { AxiosKhronosInstance } from '../../common/axios-config.js'

export type ParlayMarketKey = 'h2h' | 'spreads' | 'totals'

export interface ParlayLegInput {
	event_id: string
	outcome_uuid: string
}

export interface InitParlayRequest {
	legs: ParlayLegInput[]
	stake: number
	guild_id: string
	user_id: string
}

export interface ParlayLegPreview {
	event_id: string
	outcome_uuid: string
	market_key: ParlayMarketKey
	selection_display: string
	odds_american: number
	point: number | null
	commence_time: string
}

export interface InitParlayResponse {
	init_token: string
	combined_odds_american: number
	potential_payout: number
	legs: ParlayLegPreview[]
	expires_at: string
}

export interface PlacedParlayLeg extends ParlayLegPreview {
	id: string
	result: 'pending' | 'won' | 'lost' | 'push' | 'void'
	settled_at: string | null
}

export interface ParlayResponse {
	id: string
	user_id: string
	guild_id: string
	stake: number
	combined_odds_american: number
	potential_payout: number
	actual_payout: number | null
	status: 'pending' | 'won' | 'lost' | 'push_refunded' | 'cancelled'
	leg_count: number
	created_at: string
	settled_at: string | null
	legs: PlacedParlayLeg[]
}

export interface UserParlaysResponse {
	parlays: ParlayResponse[]
	page: number
	limit: number
	total: number
	total_pages: number
}

export interface EventOutcome {
	uuid?: string
	event_id?: string
	market_key?: string
	name?: string
	description?: string
	price?: number
	point?: number | null
	position?: string
	outcome_type?: string
	event_context?: {
		commence_time?: string
		home_team?: string
		away_team?: string
	}
}

export default class ParlayApiWrapper {
	private readonly requestConfig: AxiosRequestConfig = {
		validateStatus: (status) => status >= 200 && status < 300,
	}

	async init(payload: InitParlayRequest): Promise<InitParlayResponse> {
		const response = await AxiosKhronosInstance.post<InitParlayResponse>(
			'/parlays/init',
			payload,
			this.requestConfig,
		)
		return response.data
	}

	async place(initToken: string): Promise<ParlayResponse> {
		const response = await AxiosKhronosInstance.post<ParlayResponse>(
			'/parlays/place',
			{ init_token: initToken },
			this.requestConfig,
		)
		return response.data
	}

	async getUserParlays(
		userId: string,
		options: { page?: number; limit?: number; status?: string } = {},
	): Promise<UserParlaysResponse> {
		const response = await AxiosKhronosInstance.get<UserParlaysResponse>(
			`/parlays/user/${encodeURIComponent(userId)}`,
			{ ...this.requestConfig, params: options },
		)
		return response.data
	}

	async cancel(parlayId: string, userId: string): Promise<ParlayResponse> {
		const response = await AxiosKhronosInstance.delete<ParlayResponse>(
			`/parlays/${encodeURIComponent(parlayId)}`,
			{
				...this.requestConfig,
				data: { user_id: userId },
			},
		)
		return response.data
	}

	async getEventOutcomes(
		sport: string,
		eventId: string,
	): Promise<EventOutcome[]> {
		const response = await AxiosKhronosInstance.get<EventOutcome[]>(
			`/outcomes/event/${encodeURIComponent(sport)}/${encodeURIComponent(eventId)}`,
			this.requestConfig,
		)
		return response.data
	}
}

/** Alias used by mybets surfaces (TF-969). */
export type UserParlay = ParlayResponse
/** Alias used by mybets leg formatting (TF-969). */
export type ParlayLeg = PlacedParlayLeg
