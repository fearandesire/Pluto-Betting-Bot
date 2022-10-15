//import { SapDiscClient } from '#main'

import { embedReply } from '#config'

/**
 * Message mod bot channel a specified message
 */

export async function msgBotChan(msg, color, title) {
    var embColor = color ?? `#8000ff`
    var embTitle = title ?? `Alert`
    var embObj = {
        title: embTitle,
        description: msg,
        color: embColor,
        target: `modBotSpamID`,
    }
    await embedReply(null, embObj)
}
