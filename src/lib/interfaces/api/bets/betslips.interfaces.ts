import type { Match } from '@khronos-index'
import { IApiResponse } from '../api.interface'

export interface IPendingBetslip {
	userid: string
	amount: number
	team: string
}

export interface IPendingBetslipFull extends IPendingBetslip {
	matchup_id: string
}

export interface IAPIBetslipPayload {
	userid: string
	team: string
	amount: number
	guild_id: string
	event_id: string
	market_key: string
}

export interface ICreateBetslipFull {
	userid: string
	matchup_id: string
	team: string
	amount: number
	profit: number
	payout: number
	betresult: string
	dateofbet: Date | string
	opponent?: string
	dateofmatchup?: string
}

export interface INewBalance {
	newBalance: number
}

export interface IBetId {
	betid: number
}

export interface IFinalizedBetslip
	extends ICreateBetslipFull,
		INewBalance,
		IBetId {}

export interface ValidatedBetslipData {
	chosenTeam: string
	matchupsForTeam: Match[]
}
// Extend the base interface for a response that includes a 'betslip'
export interface IAPIProcessedBetslip extends IApiResponse {
	betslip: IFinalizedBetslip
}

// Extend the base interface for a response that includes 'chosenTeam' and 'matchupsForTeam'
export interface IValidatedBetslipData extends IApiResponse {
	chosenTeam: string
	matchupsForTeam: Match[]
	betslip: IPendingBetslip
}

export function isFinalizedBetslip(payload: any): payload is IFinalizedBetslip {
	return 'amount' in payload
}

export function isValidatedBetslipData(
	payload: any,
): payload is ValidatedBetslipData {
	return 'chosenTeam' in payload && 'matchupsForTeam' in payload
}
