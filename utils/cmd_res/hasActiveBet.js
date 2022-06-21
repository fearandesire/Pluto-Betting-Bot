import { Log } from '../bot_res/send_functions/consoleLog.js'
import { db } from '../../Database/dbindex.js'
import { embedReply } from '../bot_res/send_functions/embedReply.js'

//? identify if the user has an active bet already in the DB

export function hasActiveBet(userID, message) {
	return db
		.oneOrNone(`SELECT * FROM activebets WHERE userid = $1`, [userID])
		.then((data) => {
			if (data) {
				Log.Green(`[hasActiveBet.js] User ${userID} has an active bet`)
				Log.Green(`[hasActiveBet.js] Data:`)
				Log.BrightBlue(`${JSON.stringify(data)}`)
				var betID = data.betid
				var betAmount = data.amount
				var betTeamID = data.teamid
				var betMatchID = data.matchid
				//var betUserID = data.userid
				var embedcontent = {}
				embedcontent.color = '#00FF00'
				embedcontent.title = 'Bet Slip'
				embedcontent.description = `You have an active bet on match ${betMatchID}`
				embedcontent.fields = [
					{
						name: 'Bet ID',
						value: `${betID}`,
						inline: true,
					},
					{
						name: 'Bet Amount',
						value: `${betAmount}`,
						inline: true,
					},
					{
						name: 'Bet Team ID',
						value: `${betTeamID}`,
						inline: true,
					},
					{
						name: 'Bet Match ID',
						value: `${betMatchID}`,
						inline: true,
					},
				]
				embedReply(message, embedcontent)
				// data.forEach((row) => {
				// 	var betID = row.betjson.betdata[0].betID
				// 	var amount = row.betjson.betdata[0].amount
				// 	var teamID = row.betjson.betdata[0].teamID
				// 	var matchID = row.betjson.betdata[0].matchID

				// 	Log.BrightBlue(`[hasActiveBet.js] BetID: ${betID}`)
				// 	Log.BrightBlue(`[hasActiveBet.js] Amount: ${amount}`)
				// 	Log.BrightBlue(`[hasActiveBet.js] TeamID: ${teamID}`)
				// 	Log.BrightBlue(`[hasActiveBet.js] MatchID: ${matchID}`)
				// 	var betslip = []
				// 	betslip.push({
				// 		betID: betID,
				// 		amount: amount,
				// 		teamID: teamID,
				// 		matchID: matchID,
				// 	})
				// 	Log.BrightBlue(`[hasActiveBet.js] Bet Slip: ${betslip}`)
				// })
				return true
			} else {
				Log.Red(`[hasActiveBet.js] User ${userID} has no active bet`)
				return false
			}
		})
		.catch((err) => {
			Log.Error(`[hasActiveBet.js] Error checking for active bet\n${err}`)
			return false
		})
}
