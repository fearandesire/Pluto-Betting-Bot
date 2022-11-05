import { SapDiscClient } from '#main'

/**
 * @module dmMe
 * DMs myself a message from the bot, utilized for moving debugging embeds to go directly to me
 */

export async function dmMe(message, embed) {
    console.log(`sending DM`)
    var userid = process.env.botDevID
    await SapDiscClient.users.fetch(`${userid}`).then((user) => {
        if (embed) {
            user.send({ embeds: [embed] })
        } else {
            user.send(message)
        }
    })
}
