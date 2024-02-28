export interface NotifyBetUsers {
	winners: BetNotification[]
	losers: BetNotification[]
}

export interface BetNotification {
	userId: string
	betId: number
	result: ResultWon | ResultLost
}

export interface ResultWon {
	team: string
	betAmount: number
	payout: number
	profit: number
}

export interface ResultLost {
	team: string
	betAmount: number
}
