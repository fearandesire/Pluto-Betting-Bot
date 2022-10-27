import { QuickError, embedReply } from '#embed'

import { FileRunning } from '#botClasses/FileRunning'
import { Log } from '#LogColor'
import { confirmBet } from '#utilBetOps/confirmBet'
import { fetchBalance } from '#utilCurrency/fetchBalance'
import { isMatchExist } from '#utilValidate/isMatchExist'
import { resolveMatchup } from '#cacheUtil/resolveMatchup'
import { resolvePayouts } from '#utilBetOps/resolvePayouts'
import { setupBetLog } from '#winstonLogger'

/**
 * @module setupBet - This module is used to setup a bet in the DB.
 * @summary - Checks if the team the user wishes to bet on exists in the database, and if it does, it will send
 * the user's bet information to the next function (@link confirmBet)
 * @param {obj} message - The message object from the discord.js library
 * @param {obj} teamName - The team the user wishes to bet on.
 * @param {integer} betamount - The amount of money the user wishes to bet
 * @param {boolean} interactionEph - Whether the response should be visible to the user or not [slash cmd]
 * @references {@link placeBet.js} - The command that 'invokes' this function and passes in our parameters.
 */

export async function setupBet(
	message,
	teamName,
	betamount,
	user,
	interactionEph,
) {
	new FileRunning(`setupBet`)
	await isMatchExist(teamName).then(async (data) => {
		//? if team user wishes to bet on exists in the matchups DB, Do:
		if (data) {
			var matchid = data.matchid
			await setupBetLog.info(
				`[isMatchExist.js] Match ${matchid} [${data.teamone} vs ${data.teamtwo}] exists in the database`,
			)

			//# verify user has funds for the bet
			var checkFunds = await fetchBalance(message, user)
			if (!checkFunds) {
				QuickError(
					message,
					`Unable to locate any balance for your account in the database.`,
					true,
				)
				var userName = message?.author?.tag || message.user.username
				throw new Error(
					`User ${userName} (${user}) does not have sufficient funds to place their bet. [Unable to locate any balance for your account in the database]`,
				)
			} else if (checkFunds < betamount) {
				var embedcontent = {
					title: 'Insufficient Funds',
					description: `You do not have sufficient funds to place this bet. Your current balance is $**${checkFunds}**`,
					color: 'RED',
					target: `reply`,
				}
				await embedReply(message, embedcontent, true)
				throw Log.Error(
					`User ${user} does not have sufficient funds to place their desired bet ${betamount} on ${teamName}.\n Retrieved Balance: ${checkFunds}`,
				)
			}

			var oddsForTeam = await resolveMatchup(teamName, `odds`)
			console.log(`Odds: ${oddsForTeam}`)
			console.log(`team ID: ${teamName}`)
			setupBetLog.info(
				`Betslip Matchup Information Located:\nOdds: ${oddsForTeam}\nTeam ID: ${teamName}`,
			)
			var potentialPayout = await resolvePayouts(oddsForTeam, betamount)
			//? 'betslip' - object containing the user's bet information
			var betslip = {}
			betslip.userid = user
			betslip.amount = betamount
			betslip.teamid = teamName
			betslip.payout = potentialPayout.payout
			betslip.profit = potentialPayout.profit
			confirmBet(message, betslip, user, interactionEph) //# ask user to confirm their bet
			return true
			//? Otherwise, throw error
		} else {
			var isSilent = interactionEph ? true : false
			var embObj = {
				title: 'Bet Error',
				description: `Team containing ${teamName} is not available to bet on. Please review the active matchups.`,
				color: 'RED',
				silent: isSilent,
			}
			embedReply(message, embObj)
			throw Log.Error(
				`[setupBet.js] Team containing ${teamName} does not exist in the database`,
			)
		}
	})
}
