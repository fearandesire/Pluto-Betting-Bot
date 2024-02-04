export interface IPendingBetslip {
	amount: number
	team: string
}

export interface IPendingBetslipFull extends IPendingBetslip {
	id: string
}

export type PendingBetslip = IPendingBetslip
