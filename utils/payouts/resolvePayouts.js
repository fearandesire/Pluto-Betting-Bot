import { Log } from '#config'

/**
 * Determine the payout and profits for bets based on the bet amount and odds.
 * @param {integer} matchOdds - The odds of the team the user bet on.
 * @param {integer} betAmount - The amount of dollars the user bet.
 * @return {object} Returns an object containing the payout and profit for the bet.
 */

export async function resolvePayouts(matchOdds, betAmount) {
	matchOdds = Number(matchOdds)
	betAmount = Number(betAmount)
	if (matchOdds < 0) {
		let equation = (100 / matchOdds) * -1 //# decimal val of odds (* -1 = convert to a positive val)
		let profit = betAmount * equation
		let payout = profit + betAmount
		payout = Number(payout.toFixed(2))
		profit = Number(profit.toFixed(2))
		await Log.Green(
			`Odds: ${matchOdds}\nbetAmount: ${betAmount}\nEquation: ${equation}\nProfit: ${profit}\nPayout: ${payout}`,
		)
		return {
			payout: payout,
			profit: profit,
		}
	} else if (matchOdds > 0) {
		let equation = matchOdds / 100 + 1 //# decimal val of odds (+ 1 = the user has to get their bet amount back)
		let payout = betAmount * equation
		let profit = payout - betAmount

		payout = Number(payout.toFixed(2))
		profit = Number(profit.toFixed(2))
		await Log.Green(
			`Odds: ${matchOdds}\nbetAmount: ${betAmount}\nEquation: ${equation}\nProfit: ${profit}\nPayout: ${payout}`,
		)
		return {
			payout: payout,
			profit: profit,
		}
	}
}
