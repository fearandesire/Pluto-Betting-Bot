export default class BettingValidation {
	validateAmount(amount: number) {
		if (amount <= 0) {
			return false
		}
		return true
	}
}
