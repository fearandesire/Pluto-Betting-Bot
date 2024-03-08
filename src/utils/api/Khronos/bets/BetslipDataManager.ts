import BetslipWrapper from './betslip-wrapper'

export default class BetslipDataManager {
	constructor(private betslipWrapper: BetslipWrapper) {}

	async getActiveBets(userId: string) {
		const activeBets = await this.betslipWrapper.activeBetsForUser(userId)
	}
}
