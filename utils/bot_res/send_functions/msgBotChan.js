import { SapDiscClient } from '#main'

/**
 * Message mod bot channel a specified message
 */

export async function msgBotChan(msg, error) {
	var ID = process.env[`modBotSpamID`]
	var modBotSpam = await SapDiscClient.channels.fetch(ID)
	switch (true) {
		case error === 'error':
			msg = `**Error:** ${msg}`
			break
	}
	await modBotSpam.send(msg)
}
