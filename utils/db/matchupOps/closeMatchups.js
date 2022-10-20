import { Log, flatcache } from '#config'

import { closeMatchupsLog } from '#winstonLogger'
import { db } from '#db'

//import { removeMatch } from '#utilMatchups/removeMatchup'

/**
 * @module closeMatchups -
 * 'Closes' a specified bet - Intended for 'closing' a bet event, so the bet will only be removed from the '"NBAactivebets"' table
 * @param {object} betInformation - Object containing all the information about the bet to close out.
 *
 */

export async function closeMatchups(betInformation) {
	//# resolve() as promise
	return new Promise(async (resolve, reject) => {
		Log.Yellow(`[closeMatchups.js] Closing Bet...`)
		/**
		 * @var {integer} userid - The Discord ID of the user whose bet we are closing
		 * @var {integer} betid - The bet's ID
		 * @var {string} wonOrLost - Whether the bet was won or lost
		 * @var {integer} profit - The profit amount to be payed out
		 * @var {integer} payout - The total amount of money the user will receive
		 * @var {integer} betAmount - The amount the user bet
		 * @var {string} teamBetOn - The team the user bet on
		 * @var {string} oppsingTeam - The team going against the team the user has bet on
		 */
		var userid = betInformation?.userId
		var betid = betInformation?.betId
		var wonOrLost = betInformation?.wonOrLost
		var payout = betInformation?.payout
		var profit = betInformation?.profit
		var teamBetOn = betInformation?.teamBetOn
		var opposingTeam = betInformation?.opposingTeam
		var matchId = betInformation?.matchId
		var betAmount = betInformation?.betAmount
		closeMatchupsLog.info(
			`Launching [closeMatchups.js]\nBet Information: ${betInformation}`,
		)
		let allbetSlipsCache = flatcache.create(
			`allbetSlipsCache.json`,
			'./cache/"NBAbetslips"',
		)
		//& Won Bet Ops
		if (wonOrLost === 'won') {
			db.tx('closeMatchups', async (t) => {
				const getBetCount = await t.manyOrNone(
					`SELECT count(*) FROM "NBAactivebets" WHERE userid = $1`,
					[userid],
					(c) => c.count,
				)
				const betCount = parseInt(getBetCount[0].count) //? convert count of bets to integer
				closeMatchupsLog.info(
					`[closeMatchups.js] User ${userid} has ` +
						betCount +
						` active bet(s).`,
				)
				if (betCount === 0) {
					await closeMatchupsLog.error(
						`User ${userid} has no active bets\nCeased closing bet operations - no data has been changed,`,
					)
					resolve()
				}
				if (betCount > 0) {
					//# retrieve balance of user
					const userBal = await t.oneOrNone(
						`SELECT balance FROM "NBAcurrency" WHERE userid = $1`,
						[userid],
					)
					const payoutAmount = parseFloat(payout)
					const profitAmount = parseFloat(profit)
					const currentUserBal = parseFloat(userBal?.balance)
					const newUserBal = currentUserBal + payoutAmount
					await closeMatchupsLog.info(
						`USER ${userid} HAS WON THEIR BET (ID: ${betid}) - PROCESSING PAYOUT\n\nBALANCE INFORMATION FOR USER ${userid}:\nCurrent Balance:$${currentUserBal}\nProfit Amount:$${profitAmount}\nNew Balance:$${newUserBal}`,
					)
					await t.oneOrNone(
						`DELETE FROM "NBAactivebets" WHERE userid = $1 AND betid = $2`,
						[
							//? Delete from "NBAactivebets" table
							userid,
							betid,
						],
					),
						await closeMatchupsLog.info(
							`[closeMatchups.js] Deleted ${betid} from '"NBAactivebets"' table.`,
						)
					await t.oneOrNone(
						`UPDATE "NBAcurrency" SET balance = $1 WHERE userid = $2`,
						[newUserBal, userid],
					)
					//# update table containing all bets ["NBAbetslips"] for record purposes (bet history)
					await t.oneOrNone(
						`UPDATE "NBAbetslips" SET payout = $1, profit = $2, betresult = $3 WHERE userid = $4 AND betid = $5`,
						[payoutAmount, profitAmount, `${wonOrLost}`, userid, betid],
					)

					await allbetSlipsCache.setKey(`${userid}-hasBetsEmbed`, false)
					await allbetSlipsCache.save(true)
				}
			}).then(async (data) => {
				closeMatchupsLog.info(
					`[closeMatchups.js] Operations for ${userid} completed.`,
				)
				resolve()
			})
			//& Lost Bet Ops
		} else if (wonOrLost === 'lost') {
			db.tx('closeMatchups', async (t) => {
				const getBetCount = await t.manyOrNone(
					`SELECT count(*) FROM "NBAactivebets" WHERE userid = $1`,
					[userid],
					(c) => c.count,
				)
				const betCount = parseInt(getBetCount[0].count) //? convert count of bets to integer
				closeMatchupsLog.info(
					`[closeMatchups.js] User ${userid} has ` +
						betCount +
						` active bet(s).`,
				)
				if (betCount === 0) {
					await closeMatchupsLog.error(
						`User ${userid} has no active bets\nCeased closing bet operations - no data has been changed,`,
					)
					resolve()
				}
				if (betCount > 0) {
					await t.oneOrNone(
						`DELETE FROM "NBAactivebets" WHERE userid = $1 AND betid = $2`,
						[
							//? Delete from "NBAactivebets" table
							userid,
							betid,
						],
					),
						await closeMatchupsLog.info(
							`[closeMatchups.js] Deleted ${betid} from '"NBAactivebets"' table.`,
						)
					await t.oneOrNone(
						`UPDATE "NBAbetslips" SET betresult = $1 WHERE userid = $2 AND betid = $3`,
						[wonOrLost, userid, betid],
					)
					await allbetSlipsCache.setKey(`${userid}-hasBetsEmbed`, false)
					await allbetSlipsCache.save(true)
					closeMatchupsLog.info(
						`User <@${userid}>'s Bet ${betid} has been closed (Lost Bet).`,
					)
				}
			}).then((data) => {
				closeMatchupsLog.info(
					`[closeMatchups.js] Close Bet ${betid} Operations for ${userid} completed.`,
				)
				resolve()
			})
		}
	})
}
