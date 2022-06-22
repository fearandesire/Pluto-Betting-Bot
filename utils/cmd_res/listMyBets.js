import { CmdRunning } from '../bot_res/classes/RunCmd.js'
import { Log } from '../bot_res/send_functions/consoleLog.js'
import { db } from '../../Database/dbindex.js'
import { embedReply } from '../bot_res/send_functions/embedReply.js'
import { sliplist } from '../../lib/PlutoConfig.js'

//import { embedReply } from '../bot_res/send_functions/embedReply.js'
//import { sliplist } from '../../lib/PlutoConfig.js'

//import { embedReply } from '../bot_res/send_functions/embedReply.js'

//? identify if the user has an active bet already in the DB

export function listMyBets(userID, message) {
	new CmdRunning('listMyBets.js')
	return db
		.map(`SELECT * FROM betslips WHERE userid = $1`, [userID], (row) => {
			var amount = row.amount
			var teamID = row.teamid
			var matchID = row.matchid
			var betID = row.betid
			Log.Green(`Data Found:`)
			Log.BrightBlue(JSON.stringify(row))
			sliplist[`${userID}`] = sliplist[`${userID}`] || {}
			sliplist[`${userID}`].betslip = sliplist[`${userID}`].betslip || []
			sliplist[`${userID}`].betslip.push(
				{
					name: 'Bet ID',
					value: `${betID}`,
					inline: true,
				},
				{
					name: 'Amount',
					value: `${amount}`,
					inline: true,
				},
				{
					name: 'Team ID',
					value: `${teamID} \n \u200B`, //? \u200B is a zero-width space (blank space) to placed @ the end to create space between each bet list
					inline: true,
				},
			)
		})
		.then((data) => {
			Log.Green(`Success; Data:`)
			Log.BrightBlue(JSON.stringify(sliplist[`${userID}`].betslip))
			var embedcontent = {
				title: `${message.author.username}'s Bet Slips`,
				description: `Here are the active bets for ${message.author.username}`,
				color: '#00FF00',
				fields: sliplist[`${userID}`].betslip,
			}
			embedReply(message, embedcontent)
			//Log.BrightBlue(JSON.stringify(data))
		})
		.catch((err) => {
			Log.Error(`[listMyBets.js] Error checking for active bet\n${err}`)
			return false
		})
}
