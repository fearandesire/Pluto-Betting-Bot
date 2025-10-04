/**
 * Temporary types matching Khronos DTOs until OpenAPI client is regenerated
 * These match the DTOs in khronos/src/models/props/dto/
 */

export enum PropResultStatus {
	COMPLETED = 'completed',
}

export interface SetPropResultDto {
	propId: string
	winner: string
	status: PropResultStatus
	user_id: string
}

export interface SetPropResultResponseDto {
	correct_predictions_count: number
	incorrect_predictions_count: number
	total_predictions_count: number
}

export interface PropEventContext {
	home_team: string
	away_team: string
	commence_time: string
	sport_title: string
}

export interface Prop {
	outcome_uuid: string
	event_id: string
	event_context: PropEventContext
	market_key: string
	bookmaker_key: string
	name: string
	description?: string
	price: number
	point?: number
	position?: string
}

