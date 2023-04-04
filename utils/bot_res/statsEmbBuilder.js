import _ from 'lodash'
import { formatCurrency, embedReply } from '#config'
import { SapDiscClient } from '#main'
import { findEmoji } from '#botUtil/findEmoji'
/**
 * @module statsEmbedBuilder - Builds the embed object for the stats command
 */
export async function statsEmbedBuilder(results, header) {
	const totalBets = results.length
	const totalBetAmount = _.sumBy(results, (bet) => parseInt(bet.amount, 10))
	const averageBetAmount = totalBetAmount / totalBets
	const mostAmountBet = _.maxBy(results, 'amount').amount
	const lowestBet = _.minBy(results, 'amount').amount
	const highestProfit = _.maxBy(results, 'profit').profit
	const lowestProfit = _.minBy(results, 'profit').profit
	const dollarValues = {
		totalBetAmount,
		averageBetAmount,
		mostAmountBet,
		lowestBet,
		highestProfit,
		lowestProfit,
	}
	const totalWins = _.filter(results, (bet) => bet.betresult === 'won').length
	const winningPercentage = (totalWins / totalBets) * 100
	const mostBetOnTeam = _.chain(results)
		.countBy('teamid')
		.toPairs()
		.maxBy(_.last)
		.head()
		.value()
	Object.keys(dollarValues).forEach((key) => {
		dollarValues[key] = formatCurrency(dollarValues[key])
	})
	const color = header === 'All users' ? '#b7b4d6' : '#ff0080'
	await console.log(color)
	const teamEmoji = (await findEmoji(mostBetOnTeam)) || `:star:`
	const embedObject = {
		title: `${header} Betting Stats:`,
		description: `
        :chart_with_upwards_trend: **Totals:** :chart_with_downwards_trend:
        Wagered: \`${dollarValues.totalBetAmount}\` 
        Bets made: \`${totalBets}\`
        Avg. Bet Amount: \`${dollarValues.averageBetAmount}\`
        
        :bar_chart: **Min/Max:**
        __Profits:__
        Highest: \`${dollarValues.highestProfit}\` | Lowest: \`${
			dollarValues.lowestProfit
		}\` 
        __Wager Amount:__
        Highest: \`${dollarValues.mostAmountBet}\`  | Lowest: \`${
			dollarValues.lowestBet
		}\` 
        
        :mag_right: **Misc:**
        Total Wins: \`${totalWins}\`
        Winning Percentage: \`${winningPercentage.toFixed(2)}%\`
        Majority bet on: \`${mostBetOnTeam}\` ${teamEmoji}`,
		color,
	}
	return embedObject
}
