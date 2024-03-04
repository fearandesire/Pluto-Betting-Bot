import numeral from 'numeral'

export default class MoneyFormatter {
	static toUSD(amount: number | string) {
		return numeral(amount).format('$0,0.00')
	}
	/**
	 * @summary Format betting values to USD
	 * @description Converts the betslip amount, payout and profit to USD
	 * @param bettingNumbers - Data to format to usd
	 */
	static async formatAmounts(bettingNumbers: {
		[key: string]: number | string
	}) {
		const betAmount = MoneyFormatter.toUSD(bettingNumbers.amount)
		const payout = MoneyFormatter.toUSD(bettingNumbers.payout)
		const profit = MoneyFormatter.toUSD(bettingNumbers.profit)

		return {
			betAmount,
			payout,
			profit,
		}
	}
}
