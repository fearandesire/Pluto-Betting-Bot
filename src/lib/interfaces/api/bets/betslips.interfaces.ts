import { Matchup } from '../../../../utils/api/interfaces/interfaces'
import { IApiResponse } from '../api.interface'

export interface IPendingBetslip {
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
}

export interface ICreateBetslipFull {
	userid: string
	matchup_id: string
	team: string
	amount: number
	profit: number
	payout: number
	betresult: string
	dateofbet: string
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
	matchupsForTeam: Matchup[]
}
// Extend the base interface for a response that includes a 'betslip'
export interface IAPIProcessedBetslip extends IApiResponse {
	betslip: IFinalizedBetslip
}

// Extend the base interface for a response that includes 'chosenTeam' and 'matchupsForTeam'
export interface IValidatedBetslipData extends IApiResponse {
	chosenTeam: string
	matchupsForTeam: Matchup[]
}

export function isFinalizedBetslip(payload: any): payload is IFinalizedBetslip {
	return 'matchup_id' in payload
}

export function isValidatedBetslipData(
	payload: any,
): payload is ValidatedBetslipData {
	return 'chosenTeam' in payload && 'matchupsForTeam' in payload
}
