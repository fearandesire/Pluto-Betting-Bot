import _ from 'lodash'
import db from '@pluto-db'
import {
	Log,
	LIVEMATCHUPS,
	BETSLIPS,
	LIVEBETS,
	CURRENCY,
} from '@pluto-core-config'

import { resolvePayouts } from '@pluto-betOps/resolvePayouts.js'
import { SapDiscClient } from '@pluto-core'
import { PlutoLogger } from '@pluto-logger'
import { getBalance } from '../../validation/getBalance.js'
import BetNotify from '../BetNotify.js'

/**
 * @module closeWonBets
 * 1. Query DB and find all bets that chose the winning team [teamid] in thedb
 * 2. Calculate payout for the bets, and update the db  with the payout
 * 3. Update the user balance in the dbwith the payout
 * 4. DM the user they won their bet
 * @param {string} winningTeam - The team that won the game
 * @param {string} homeOrAway - If this team that won was 'home' or 'away' - string literal
 * @param {string} losingTeam - The losing team
 */

export async function closeWonBets(
	winningTeam,
	homeOrAway,
	losingTeam,
) {
	const getMatchInfo = await db.oneOrNone(
		`SELECT * FROM "${LIVEMATCHUPS}" WHERE teamone = $1 AND teamtwo = $2 OR teamone = $2 AND teamtwo = $1`,
		[winningTeam, losingTeam],
	) // Query DB for matchup info

	if (!getMatchInfo || _.isEmpty(getMatchInfo)) {
		await PlutoLogger.log({
			id: 4,
			description: `An error occured when closing winning bets.\nUnable to find matchup in database: ${winningTeam} vs ${losingTeam}`,
		})
		return false
	}

	const winningBets = await db.manyOrNone(
		`SELECT * FROM "${BETSLIPS}" WHERE teamid = $1 AND betresult = 'pending'`,
		[winningTeam],
	)
	// No bets for the winning team
	if (_.isEmpty(winningBets)) {
		return
	}

	const betNotify = new BetNotify(SapDiscClient)
	for await (const betslip of winningBets) {
		const betAmount = betslip.amount
		const betId = betslip.betid
		const { userid } = betslip
		let betOdds
		let opposingTeam
		let teamBetOn

		if (homeOrAway === 'home') {
			betOdds = getMatchInfo.teamoneodds
			opposingTeam = getMatchInfo.teamtwo
			teamBetOn = getMatchInfo.teamone
		} else if (homeOrAway === 'away') {
			betOdds = getMatchInfo.teamtwoodds
			opposingTeam = getMatchInfo.teamone
			teamBetOn = getMatchInfo.teamtwo
		}

		const { payout, profit } = await resolvePayouts(
			betOdds,
			betAmount,
		)
		const payoutAmount = Math.floor(parseFloat(payout))
		const profitAmount = Math.floor(parseFloat(profit))
		const currentBalance = await getBalance(userid)
		await Promise.all([
			PlutoLogger.log({
				id: 3,
				description: `Closing Bet Information:\nUser ID: ${userid}\nBet ID: ${betId}\nBet Result: Won\nBet Amount: ${betAmount}\nBet Odds: ${betOdds}\nTeam Bet On: ${teamBetOn}\nOpposing Team: ${opposingTeam}\nWinning Team: ${winningTeam}\nHome or Away: ${homeOrAway}\nPayout: ${payoutAmount}\nProfit: ${profitAmount}`,
			}),
			// ? Update Betslip
			db.none(
				`UPDATE "${BETSLIPS}" SET betresult = 'won', payout = $1, profit = $2 WHERE betid = $3`,
				[payoutAmount, profitAmount, betId],
			),
			// ? Delete Live Bet
			db.none(
				`DELETE FROM "${LIVEBETS}" WHERE betid = $1`,
				[betId],
			),
			//  ? Update user balance
			db.none(
				`UPDATE "${CURRENCY}" SET balance = balance + $1 WHERE userid = $2`,
				[payoutAmount, userid],
			),
			betNotify.notifyUser(userid, {
				betId,
				teamBetOn,
				opposingTeam,
				betAmount,
				payout,
				profit,
				currentBalance,
				betResult: 'won',
			}),
			Log.Green(
				`Successfully closed bet ${betId} || ${userid}`,
			),
		])
	}
}
