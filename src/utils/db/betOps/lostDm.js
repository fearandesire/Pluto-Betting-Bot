import { Log } from '@pluto-core-config'
import { SapDiscClient } from '@pluto-core'
import { dmLog } from '../../logging.js'
import { isInServer } from '../../bot_res/isInServer.js'

// import { removeUserProfile } from './removeUserProfile.js'

/**
 * @module lostDm
 * Send a DM to the user who lost the bet
 */

export async function lostDm(betInformation) {
	const userid = betInformation?.userId
	const betid = betInformation?.betId
	const teamBetOn = betInformation?.teamBetOn
	const opposingTeam = betInformation?.opposingTeam
	const betAmount = betInformation?.betAmount

	const verifyUser = await isInServer(userid)
	if (verifyUser == false) {
		await dmLog.info(
			`User ${userid} is no longer in the server. Removing bet ${betid} from the database.`,
		)
		return
	}
	const embObj = {
		title: `${teamBetOn} vs. ${opposingTeam}`,
		description: `You lost your $${betAmount} bet on the ${teamBetOn}. Sorry, better luck next time!`,
		color: `#ff0000`,
		footer: `See an issue here? Please contact FENIX#7559 | Bet ID: ${betid}`,
	}
	// # DM the user the result of their bet
	await SapDiscClient.users
		.fetch(`${userid}`)
		.then((user) => {
			if (!user) {
				dmLog.error(
					`Failed to send DM to user ${userid} is no longer in the server.`,
				)
				return
			}
			// # Catch any errors that may occur when sending the DM, like the user blocking the bot, having DMs disabled, etc
			try {
				user.send({ embeds: [embObj] }).catch(
					() => {
						dmLog.error(
							`Failed to send DM to user ${userid}.`,
						)
						Log.Red(
							`Failed to send DM to user ${userid}.`,
						)
					},
				)
				dmLog.info(`DM'd ${userid} successfully`)
			} catch (error) {
				dmLog.error(
					`Failed to send DM to user ${userid} is no longer in the server.`,
				)
				Log.Red(
					`Failed to send DM to user ${userid} is no longer in the server.`,
				)
			}
		})
}
