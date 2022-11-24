import { MessageEmbed } from 'discord.js'
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
            //# hex color array for embeds to use randomly
            var hexColorArray = [
                `#3abc2c`,
                `#f1c40f`,
                `#e74c3c`,
                `#3498db`,
                `#9b59b6`,
                `#34495e`,
                `#2ecc71`,
                `#1abc9c`,
                `#95a5a6`,
                `#f39c12`,
                `#d35400`,
                `#c0392b`,
                `#bdc3c7`,
                `#7f8c8d`,
            ]
            var randomColor =
                hexColorArray[Math.floor(Math.random() * hexColorArray.length)]
            //# compile embed
            var formatEmb = new MessageEmbed()
                .setTitle(`Notification`)
                .setDescription(message)
                .setColor(`${randomColor}`)
            user.send({ embeds: [formatEmb] })
        }
    })
}
