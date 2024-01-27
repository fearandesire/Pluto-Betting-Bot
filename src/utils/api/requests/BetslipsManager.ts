/**
 * @fileoverview
 * Module to address the initialization of a user requesting to place a bet.
 * Forwards betslip initial data to Khronos for validating & processing
 */

interface InitBetslipData {
	userid: number
	team: string
	amount: number
}

export default class BetslipManager {
	constructor() {}

	async sendInitBetslip(newBetslip: InitBetslipData) {
	}
}
