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
	newBalance?: number
	oldBalance?: number
}

export interface ResultLost {
	outcome: 'lost'
	team: string
	betAmount: number
}

/**
 * Why Khronos refunded a bet. Payloads from Khronos builds that predate the
 * field carry none, and those builds only sent ties.
 */
export const BET_REFUND_REASONS = [
	'tie',
	'postponed',
	'cancelled',
	'abandoned',
	'void',
] as const

export type BetRefundReason = (typeof BET_REFUND_REASONS)[number]

export interface ResultPush {
	outcome: 'push'
	team: string
	betAmount: number
	refundReason?: BetRefundReason
}

export interface BetNotificationBase {
	userId: string
	/** Optional for shared-contract winners that are not tied to a single bet. */
	betId?: number
	/** Optional until Khronos includes guild context in bet-result callbacks. */
	guildId?: string
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
