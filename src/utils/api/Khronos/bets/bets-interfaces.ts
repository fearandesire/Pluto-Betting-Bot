export interface IBetResult {
	betid: number;
	userid: string;
	matchup_id: string;
	team: string;
	amount: number | string;
	profit: number | string;
	payout: number | string;
	betresult: string;
	dateofbet: string;
	newBalance?: number | string;
	oldBalance?: number | string;
}
