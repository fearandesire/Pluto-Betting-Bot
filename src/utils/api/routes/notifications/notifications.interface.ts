export interface NotifyBetUsers {
	winners: BetNotificationWon[]
	losers: BetNotificationLost[]
}

export interface ResultWon {
	team: string
	betAmount: number
	payout: number
	profit: number
	newBalance: number
	oldBalance: number
}

export interface ResultLost {
	team: string
	betAmount: number
}

export interface BetNotificationBase {
	userId: string
	betId: number
}

export interface BetNotificationWon extends BetNotificationBase {
	result: ResultWon
}

export interface BetNotificationLost extends BetNotificationBase {
	result: ResultLost
}

export interface DisplayResultWon extends ResultWon {
	displayBetAmount: string
	displayPayout: string
	displayProfit: string
	displayNewBalance: string
	displayOldBalance: string
}

export interface DisplayResultLost extends ResultLost {
	displayBetAmount: string
}
export interface DisplayBetNotificationWon extends BetNotificationWon {
	displayResult: DisplayResultWon
}

export interface DisplayBetNotificationLost extends BetNotificationLost {
	displayResult: DisplayResultLost
}

export type DisplayBetNotification =
	| DisplayBetNotificationWon
	| DisplayBetNotificationLost
