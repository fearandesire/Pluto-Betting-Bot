export interface NotifyBetUsers {
	winners?: BetNotificationWon[]
	losers?: BetNotificationLost[]
	pushes?: BetNotificationPush[]
}

export interface ResultWon {
	outcome: 'won'
	team: string
	betAmount: number
	payout: number
	profit: number
	newBalance: number
	oldBalance: number
}

export interface ResultLost {
	outcome: 'lost'
	team: string
	betAmount: number
}

export interface ResultPush {
	outcome: 'push'
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

export interface BetNotificationPush extends BetNotificationBase {
	result: ResultPush
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

export interface DisplayResultPush extends ResultPush {
	displayBetAmount: string
}

export interface DisplayBetNotificationWon extends BetNotificationWon {
	displayResult: DisplayResultWon
}

export interface DisplayBetNotificationLost extends BetNotificationLost {
	displayResult: DisplayResultLost
}

export interface DisplayBetNotificationPush extends BetNotificationPush {
	displayResult: DisplayResultPush
}

export type DisplayBetNotification =
	| DisplayBetNotificationWon
	| DisplayBetNotificationLost
	| DisplayBetNotificationPush
