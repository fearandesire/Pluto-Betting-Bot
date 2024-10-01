import type { Match } from '@kh-openapi';
import type { IApiResponse } from '../api.interface.js';

export interface IPendingBetslip {
	userid: string;
	amount: number;
	team: string;
}

export interface IAPIBetslipPayload {
	userid: string;
	team: string;
	amount: number;
	guild_id: string;
	event_id: string;
	market_key: string;
}

export interface ICreateBetslipFull {
	userid: string;
	matchup_id: string;
	team: string;
	amount: number;
	profit: number;
	payout: number;
	betresult: string;
	dateofbet: Date | string;
	opponent?: string;
	dateofmatchup?: string;
}

export interface INewBalance {
	newBalance: number;
}

export interface IBetId {
	betid: number;
}

export interface IFinalizedBetslip
	extends ICreateBetslipFull,
		INewBalance,
		IBetId {}
