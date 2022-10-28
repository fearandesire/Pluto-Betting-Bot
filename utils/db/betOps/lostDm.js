import { SapDiscClient } from '#main'
import { dmLog } from '../../logging.js'
import { isInServer } from '../../bot_res/isInServer.js'

//import { removeUserProfile } from './removeUserProfile.js'

/**
 * @module lostDm
 * Send a DM to the user who lost the bet
 */

export async function lostDm(betInformation) {
	var userid = betInformation?.userId
	var betid = betInformation?.betId
	var teamBetOn = betInformation?.teamBetOn
	var opposingTeam = betInformation?.opposingTeam
	var betAmount = betInformation?.betAmount

	var verifyUser = await isInServer(userid)
	if (verifyUser == false) {
		await dmLog.info(
			`User ${userid} is no longer in the server. Removing bet ${betid} from the database.`,
		)
		return
	}
	var embObj = {
		title: `${teamBetOn} vs. ${opposingTeam}`,
		description: `You lost your $${betAmount} bet on the ${teamBetOn}. Sorry, better luck next time!`,
		color: `#ff0000`,
		footer: `See an issue here? Please contact FENIX#7559 | Bet ID: ${betid}`,
	}
	//# DM the user the result of their bet
	await SapDiscClient.users
		.fetch(`${userid}`)
		.then((user) => {
			if (!user) {
				dmLog.error(
					`Failed to send DM to user ${userid} is no longer in the server.`,
				)
				return
			}
			user.send({ embeds: [embObj] })
			dmLog.info(`DM'd ${userid} successfully`)
		})
		.catch((err) => {
			dmLog.error(`Failed to send DM to user ${userid}. Error: ${err}`)
			return
		})
}
