// import { SapDiscClient } from '#main'

import { embedReply } from '#config'

/**
 * Message mod bot channel a specified message
 */

export async function msgBotChan(msg, color, title) {
	const embColor = color ?? `#8000ff`
	const embTitle = title ?? `Alert`
	const embObj = {
		title: embTitle,
		description: msg,
		color: embColor,
		target: `modBotSpamID`,
	}
	await embedReply(null, embObj)
}
