import { FileRunning } from '../bot_res/classes/FileRunning.js'
import { Log } from '../bot_res/send_functions/consoleLog.js'
import { embedReply } from '../bot_res/send_functions/embedReply.js'
import { resovleMatchup } from '../cache/resolveMatchup.js'
import { resolvePayouts } from '../payouts/resolvePayouts.js'
import { confirmBet } from './confirmBet.js'
import { isMatchExist } from './isMatchExist.js'

/**
 * @module setupBet - This module is used to setup a bet in the DB.
 * @summary - Checks if the team the user wishes to bet on exists in the database, and if it does, it will send
 * the user's bet information to the next function (@link confirmBet)
 * @param {obj} message - The message object from the discord.js library
 * @param {obj} teamid - The team the user wishes to bet on.
 * @param {integer} betamount - The amount of money the user wishes to bet
 * @references {@link placeBet.js} - The command that 'invokes' this function and passes in our parameters.
 */

export async function setupBet(message, teamid, betamount) {
	new FileRunning(`setupBet`)
	await isMatchExist(teamid).then(async (data) => {
		//? if team user wishes to bet on exists in the matchups, Do:
		if (data) {
			var matchid = data.matchid
			Log.Green(
				`[isMatchExist.js] Match ${matchid} [${data.teamone} vs ${data.teamtwo}] exists in the database`,
			)
			var oddsForTeam = await resovleMatchup(teamid, `odds`)
			console.log(`Odds: ${oddsForTeam}`)
			console.log(`team ID: ${teamid}`)
			var potentialPayout = await resolvePayouts(oddsForTeam, betamount)
			//? 'betslip' - object containing the user's bet information
			var betslip = {}
			var user = message.author.id
			betslip.userid = user
			betslip.amount = betamount
			betslip.teamid = teamid
			betslip.payout = potentialPayout.payout
			betslip.profit = potentialPayout.profit
			Log.Yellow(JSON.stringify(betslip)) //? Debug purposes, this will likely be removed later. For now, it's intended to confirm the user's input
			confirmBet(message, betslip, user)
			console.log(`user id: ${user}`)
			return true
			//? Otherwise, throw error
		} else {
			var embedcontent = {
				title: 'Bet Error',
				description: `Team containing ${teamid} is not available to bet on. Please review the active matchups.`,
				color: 'RED',
			}
			embedReply(message, embedcontent)
			throw Log.Error(
				`[setupBet.js] Team containing ${teamid} does not exist in the database`,
			)
		}
	})
}
