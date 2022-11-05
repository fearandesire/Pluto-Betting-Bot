import { SapDiscClient } from '#main'

/**
 * @module dmMe
 * DMs myself a message from the bot, utilized for moving debugging embeds to go directly to me
 */

export async function dmMe(message, embed) {
    var userid = process.env.botDevID
    var botOwner = await SapDiscClient.users.fetch(`${userid}`)
    if (embed) {
        botOwner.send({ embeds: [embed] })
    } else {
        botOwner.send(message)
    }
}
