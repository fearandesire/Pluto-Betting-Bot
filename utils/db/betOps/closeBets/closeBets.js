import _ from 'lodash'
import {
	LIVEMATCHUPS,
	BETSLIPS,
	LIVEBETS,
	CURRENCY,
} from '#config'

import { db } from '#db'
import { resolvePayouts } from '#utilBetOps/resolvePayouts'
import { SapDiscClient } from '#main'
import PlutoLogger from '#PlutoLogger'
import { getBalance } from '../../validation/getBalance.js'
import BetNotify from '../BetNotify.js'

const betNotify = new BetNotify(SapDiscClient)

/**
 * Retrieves match information for two teams.
 *
 * @param {string} teamOne - The name of team one.
 * @param {string} teamTwo - The name of team two.
 * @return {Promise<Object|null>} A Promise that resolves to the match information for the two teams,
 *         or null if no match information is found.
 */
async function getMatchInfo(teamOne, teamTwo) {
	return db.oneOrNone(
		`SELECT * FROM "${LIVEMATCHUPS}" WHERE teamone = $1 AND teamtwo = $2 OR teamone = $2 AND teamtwo = $1`,
		[teamOne, teamTwo],
	)
}

async function getBets(winningTeam, losingTeam) {
	return db.manyOrNone(
		`SELECT * FROM "${BETSLIPS}" WHERE teamid = $1 AND betresult = 'pending' OR teamid = $2 AND betresult = 'pending'`,
		[winningTeam, losingTeam],
	)
}

/**
 * Selects the odds for a specific team in a match.
 *
 * @param {Object} matchData - The data of the match.
 * @param {string} team - The team to select odds for.
 * @return {Object} An object containing the odds for the team and the opposing team.
 */

async function selectOdds(matchData, team) {
	const { teamone, teamtwo, teamoneodds, teamtwoodds } =
		matchData
	// Match team to teamone or teamtwo and return odds for the match
	if (team === teamone) {
		return {
			odds: teamoneodds,
			opposingTeam: teamtwo,
		}
	}
	if (team === teamtwo) {
		return {
			odds: teamtwoodds,
			opposingTeam: teamone,
		}
	}
	await PlutoLogger.log({
		id: 4,
		description: `An error occured when closing bets.\nUnable to find matchup in database: ${teamone} vs ${teamtwo}`,
	})
	throw new Error(`Unable to process bets for ${team}`)
}

/**
 * Handle DB operation for closing a bet
 */

async function handleClosingBet(
	/**
	 * Handles the closing of a bet.
	 * @param {string} userid - The ID of the user placing the bet.
	 * @param {string} betResult - The result of the bet ("won" or "lost").
	 * @param {string} betId - The ID of the bet.
	 * @param {object} betInfo - Information about the bet.
	 * @param {number} betInfo.payoutAmount - The amount to be paid out if the bet is won.
	 * @param {number} betInfo.profitAmount - The profit amount of the bet.
	 */
	userid,
	betResult,
	betId,
	betInfo,
) {
	if (betResult === `won`) {
		const { payoutAmount, profitAmount } = betInfo
		await db.none(
			`UPDATE "${BETSLIPS}" SET betresult = 'won', payout = $1, profit = $2 WHERE betid = $3`,
			[payoutAmount, profitAmount, betId],
		)
		await db.none(
			`UPDATE "${CURRENCY}" SET balance = balance + $1 WHERE userid = $2`,
			[payoutAmount, userid],
		)
	} else if (betResult === `lost`) {
		await db.none(
			`UPDATE "${BETSLIPS}" SET betresult = 'lost' WHERE betid = $1`,
			[betId],
		)
	}
	// await db.none(
	// 	`DELETE FROM "${LIVEBETS}" WHERE betid = $1`,
	// 	[betId],
	// )
}

/**
 * Closes the bets for a given match result.
 *
 * @param {string} winningTeam - The team that won the match.
 * @param {string} losingTeam - The team that lost the match.
 * @return {boolean} Returns false if an error occurred, otherwise nothing is returned.
 */
async function closeBets(winningTeam, losingTeam) {
	const matchInfo = await getMatchInfo(
		winningTeam,
		losingTeam,
	)
	await PlutoLogger.log({
		id: 3,
		description: `Closing bets for ${winningTeam} vs ${losingTeam}`,
	})
	if (!matchInfo || _.isEmpty(matchInfo)) {
		await PlutoLogger.log({
			id: 4,
			description: `An error occured when closing bets.\nUnable to find matchup in database: ${winningTeam} vs ${losingTeam}`,
		})
		return false
	}

	const bets = await getBets(winningTeam, losingTeam)

	if (_.isEmpty(bets)) {
		return
	}

	for await (const betslip of bets) {
		const betAmount = betslip.amount
		const betId = betslip.betid
		const { userid: userId } = betslip

		const teamBetOn = betslip.teamid
		const { odds: betOdds, opposingTeam } =
			await selectOdds(matchInfo, teamBetOn)

		let betResult

		if (teamBetOn === winningTeam) {
			betResult = 'won'
		} else if (teamBetOn === losingTeam) {
			betResult = 'lost'
		}

		if (betResult === 'won') {
			const { payout, profit } = await resolvePayouts(
				betOdds,
				betAmount,
			)
			const payoutAmount = Math.floor(
				parseFloat(payout),
			)
			const profitAmount = Math.floor(
				parseFloat(profit),
			)
			const currentBalance = await getBalance(userId)
			await PlutoLogger.log({
				id: 3,
				description: `Closing Bet Information:\nUser ID: ${userId}\nBet ID: ${betId}\nBet Result: Won\nBet Amount: ${betAmount}\nBet Odds: ${betOdds}\nTeam Bet On: ${teamBetOn}\nOpposing Team: ${opposingTeam}\nWinning Team: ${winningTeam}\nPayout: ${payoutAmount}\nProfit: ${profitAmount}`,
			})
			await handleClosingBet(
				userId,
				betResult,
				betId,
				{
					payoutAmount,
					profitAmount,
				},
			)
			await betNotify.notifyUser(userId, {
				betId,
				teamBetOn,
				opposingTeam,
				betAmount,
				payout,
				profit,
				currentBalance,
				betResult: 'won',
			})
		} else if (betResult === 'lost') {
			await PlutoLogger.log({
				id: 3,
				description: `Closing Bet Information:\nUser ID: ${userId}\nBet ID: ${betId}\nBet Result: Won\nBet Amount: ${betAmount}\nBet Odds: ${betOdds}\nTeam Bet On: ${teamBetOn}\nOpposing Team: ${opposingTeam}\nWinning Team: ${winningTeam}\n`,
			})
			await handleClosingBet(userId, betResult, betId)
		}
	}
}

export { closeBets }
