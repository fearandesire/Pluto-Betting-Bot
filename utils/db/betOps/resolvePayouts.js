import { Log } from '#config'

/**
 * Determine the payout and profits for bets based on the bet amount and odds.
 * @param {integer} oddsNum - The odds of the team the user bet on.
 * @param {integer} ogBetAmount - The amount of dollars the user bet.
 * @return {object} Returns an object containing the payout and profit for the bet.
 */

export async function resolvePayouts(matchOdds, betAmount) {
	const oddsNum = Number(matchOdds)
	const ogBetAmount = Number(betAmount)

	if (oddsNum < 0) {
		const equation = (100 / oddsNum) * -1
		const profit = Math.ceil(ogBetAmount * equation)
		const payout = Math.ceil(profit + ogBetAmount)

		await Log.Green(
			`Odds: ${oddsNum}\nbetAmount: ${ogBetAmount}\nEquation: ${equation}\nProfit: ${profit}\nPayout: ${payout}`,
		)

		return {
			payout,
			profit,
		}
	}

	if (oddsNum > 0) {
		const equation = oddsNum / 100 + 1
		const payout = Math.ceil(ogBetAmount * equation)
		const profit = Math.ceil(payout - ogBetAmount)

		await Log.Green(
			`Odds: ${oddsNum}\nbetAmount: ${ogBetAmount}\nEquation: ${equation}\nProfit: ${profit}\nPayout: ${payout}`,
		)

		return {
			payout,
			profit,
		}
	}
}
