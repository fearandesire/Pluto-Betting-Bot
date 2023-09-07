import {
	LIVEMATCHUPS,
	queryBuilder as qBuilder,
} from '#config'
import { QuickError, embedReply } from '#embed'

import { Log } from '#LogColor'
import { confirmBet } from '#utilBetOps/confirmBet'
import { fetchBalance } from '#utilCurrency/fetchBalance'
import PendingBetHandler from '#utilValidate/pendingBet'
import { resolveMatchup } from '#cacheUtil/resolveMatchup'
import { resolvePayouts } from '#utilBetOps/resolvePayouts'
import { validateData } from '../validation/validateData.js'
import embedColors from '../../../lib/colorsConfig.js'

/**
 * @module setupBet - This module is used to setup a bet in the DB.
 * @summary - Checks if the team the user wishes to bet on exists in the database, and if it does, it will send
 * the user's bet information to the next function ({@link confirmBet})
 * @param {obj} message - The message object from the discord.js library
 * @param {obj} betOnTeamName - The team the user wishes to bet on.
 * @param {integer} betamount - The amount of money the user wishes to bet
 * @param {integer} user - The user's discord ID
 */

export async function setupBet(
	message,
	teamName,
	betamount,
	user,
) {
	const dbQuery = qBuilder(
		`${LIVEMATCHUPS}`,
		[`teamone`, `teamtwo`],
		teamName,
	)
	await new validateData(dbQuery)
		.uniqueRowOr()
		.then(async (data) => {
			// ? if team user wishes to bet on exists in the matchups DB, Do:
			if (data) {
				// # verify user has funds for the bet
				const checkFunds = await fetchBalance(
					message,
					user,
				)
				if (!checkFunds) {
					QuickError(
						message,
						`Unable to locate any balance for your account in the database.`,
						true,
					)
					const userName =
						message?.author?.tag ||
						message.user.username
					throw new Error(
						`User ${userName} (${user}) does not have sufficient funds to place their bet. [Unable to locate any balance for your account in the database]`,
					)
				} else if (checkFunds < betamount) {
					await PendingBetHandler.deletePending(
						user,
					)
					const embedcontent = {
						title: 'Insufficient Funds',
						description: `You do not have sufficient funds to place this bet. Your current balance is $**${checkFunds}**`,
						color: 'RED',
						target: `reply`,
						followUp: true,
					}
					await embedReply(
						message,
						embedcontent,
						true,
					)
					throw Log.Error(
						`User ${user} does not have sufficient funds to place their desired bet ${betamount} on ${teamName}.\n Retrieved Balance: ${checkFunds}`,
					)
				}

				const oddsForTeam = await resolveMatchup(
					teamName,
					`odds`,
				)
				const potentialPayout =
					await resolvePayouts(
						oddsForTeam,
						betamount,
					)
				// ? 'betslip' - object containing the user's bet information
				const betslip = {}
				betslip.userid = user
				betslip.amount = betamount
				betslip.teamid = teamName
				betslip.payout = potentialPayout.payout
				betslip.profit = potentialPayout.profit
				await confirmBet(message, betslip, user) // # Ask user to confirm their bet
				return true
				// ? Otherwise, throw error
			}
			const embObj = {
				title: 'Bet Error',
				description: `Team containing ${teamName} is not available to bet on. Please review the active matchups.`,
				color: embedColors.PlutoRed,
				silent: true,
			}
			await embedReply(message, embObj)
		})
}
