/* eslint-disable no-irregular-whitespace */
import {
	accounting,
	container,
	LIVEMATCHUPS,
	LIVEBETS,
	BETSLIPS,
} from '#config'

import { Log } from '#LogColor'
import { db } from '#db'
import { embedReply, guildImgURL } from '#embed'
import { setupBetLog } from '#winstonLogger'

import { TodaysDate } from '../../date/TodaysDate.js'

/**
 * @module addNewBet -
 * Adds a new bet to the database with the provided information inside of the betslip object.⁡
 * ⁡⁣⁣⁢Queries the 'activeMatchups' table in the DB to gather the matchup ID using the provided team IDs⁡
 * @param {obj} interaction - The interaction object - contains the user info from Discord & allows us to reply to the user.
 * @param {obj} betslip - Object containing the user's bet information. The betslip object model is inherited from: placebet.js (command) > confirmbet.js (user confirms bet).
 * @returns {embed} - Resolves with an embed reply to the user that their bet has been placed.
 *  For documentation / debugging purposes, the object's final structure is compiled as: { userid: '⁡⁣⁣⁢𝙣⁡',  teamid: '⁡⁣⁣⁢𝘯⁡', betid: '⁡⁣⁣⁢𝘯⁡', amount: '⁡⁣⁣⁢𝘯⁡', matchid: '⁡⁣⁣⁢𝙣⁡'  'hasactivebet': '⁡⁣⁣⁢𝙣⁡', 'dateofbet': '⁡⁣⁣⁢𝙣⁡' }
 * @references
 * - {@link confirmBet.js} Origin call of addNewBet.js.
 * - {@link embedReply} - Embed constructor for the reply.
 *
 */

export function addNewBet(interaction, betslip) {
	/*
    Querying DB using db.tx since we are handling multiple transactions
    First query: Selecting the 'matchid' as its required for us to store the betslip information in the DB.
    */
	db.tx('createNewBet', (t) =>
		t
			.one(
				`SELECT matchid from "${LIVEMATCHUPS}" WHERE teamone = $1 OR teamtwo = $1`,
				/** @property {Object} betslip.teamid - The team name the user has input */
				[betslip.teamid],
			)
			.then((data) => {
				container.temp_matchId = data.matchid
				const date = TodaysDate()
				return t.none(
					`INSERT INTO "${BETSLIPS}" (userid, teamid, betid, amount, matchid, dateofbet, betresult, profit, payout) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
					[
						betslip.userid,
						betslip.teamid,
						betslip.betid,
						betslip.amount,
						data.matchid,
						date,
						'pending',
						betslip.profit,
						betslip.payout,
					], // ? Insert betslip information into the database
				)
			})
			.then((data) => {
				setupBetLog.info(
					`Storing betslip into database - "${LIVEBETS}"\nData: ${data}\nBetslip: ${betslip}`,
				)
				return t.none(
					`INSERT INTO "${LIVEBETS}" (betid, userid, teamid, matchid, amount) VALUES ($1, $2, $3, $4, $5)`,
					[
						betslip.betid,
						betslip.userid,
						betslip.teamid,
						container.temp_matchId,
						betslip.amount,
					], // ? Insert betslip information into the database
				)
			})
			.then(() => {
				setupBetLog.info(
					`Successfully added betslip into the database.`,
				)
				const { format } = accounting
				const amount = format(betslip.amount)
				const profit = format(betslip.profit)
				const payout = format(betslip.payout)
				const embedcontent = {
					// ? Compiling the properties of the embed to return to the user: confirming their bet has been added to DB
					title: `:ticket: Bet confirmed!`,
					description: `<@${betslip.userid}>, your bet is locked in! :lock:
                    
                    **:money_mouth: __Details__**
                    **Bet ID:** ${betslip.betid}
                    **Team:** **${betslip.teamid}** ${betslip.teamEmoji}
                    **Amount:** \`$${amount}\`
                    **Profit:** \`$${profit}\`
                    **Payout:** \`$${payout}\`

                    *To view all of your active bets, type \`/mybets\`
                    To view your history of betting with Pluto, type \`/bethistory\`*
                    `,
					color: '#00FF00',
					// footer: 'For more commands, type: ?help',
					target: `reply`,
					thumbnail: `${guildImgURL(
						interaction.client,
					)}`,
					editReply: true,
				}
				return embedReply(interaction, embedcontent) // ? Sending the embed to the user via our embedReply function in [embedReply.js]
			})
			.catch((err) => {
				Log.Error(
					`[addNewBet.js] Error adding bet to activebets table\n${err}`,
				)
				setupBetLog.error(
					`Error adding bet to activebets table\n${err}`,
				)
			}),
	)
}
