import _ from 'lodash'
import Promise from 'bluebird'
import { db } from '#db'
import { embedReply, findEmoji } from '#config'
import { fetchTodaysMatches as fetchToday } from '#matchMngr'
/**
 * @module scheduleEmbed
 * @description Creates the embed that contains all matchups w. game odds currently in the database. scheduled.
 * @returns {object} - Object to be used for embed compilation
 */

export async function scheduleEmbed() {
    return new Promise(async (resolve, reject) => {
        const playingToday = await fetchToday()
        const count = playingToday.length
        // #  currentSch will be an array of objects for the games currently stored.
        // ? Use Lodash to create a simple string containing the teams, odds & start time.
        const matchesStr = await Promise.map(playingToday, async (game) => {
            let tOne = await findEmoji(game.teamone, true)
            let tTwo = await findEmoji(game.teamtwo, true)

            if (tOne === null) {
                tOne = game.teamone
            }
            if (tTwo === null) {
                tTwo = game.teamtwo
            }
            return `**• ${tOne}** *(${game.teamoneodds})* vs. **${tTwo}** *(${game.teamtwoodds})* | **${game.legiblestart}**`
        }).then((res) => res.join('\n'))

        const embed = {
            title: `Games Scheduled`,
            description: `${matchesStr}\n\n*${count} games total.*`,
            color: '#a0b9f3',
            target: `modBotSpamID`,
            footer: `All game channels will be created 1 hour ahead of their start (EST)`,
        }
        resolve(await embedReply(null, embed))
    })
}
