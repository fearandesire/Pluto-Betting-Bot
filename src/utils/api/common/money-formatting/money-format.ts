import numeral from 'numeral'

export default class MoneyFormatter {
	static toUSD(amount: number) {
		return numeral(amount).format('$0,0.00')
	}
}
