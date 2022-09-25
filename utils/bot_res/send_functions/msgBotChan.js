//import { SapDiscClient } from '#main'

import { embedReply } from '#config'

/**
 * Message mod bot channel a specified message
 */

export async function msgBotChan(msg, error) {
    var ID = `modBotSpamID`
    //var modBotSpam = await SapDiscClient.channels.fetch(ID)
    var emColor = `#8000ff`
    switch (true) {
        case error === 'error':
            msg = `**Error:** ${msg}`
            emColor = 'RED'
            break
    }
    var embObj = {
        title: `Alert`,
        description: msg,
        color: emColor,
        target: `modBotSpamID`,
    }
    await embedReply(null, embObj)
    //    await modBotSpam.send(msg)
}
