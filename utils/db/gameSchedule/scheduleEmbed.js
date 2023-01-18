import { db } from '#db'
import { LIVEMATCHUPS, container } from '#config'
import _ from 'lodash'
/**
 * @module scheduleEmbed
 * @description Creates the embed that contains all matchups w. game odds currently in the database. scheduled.
 * @returns {object} - Object to be used for embed compilation
 */

export async function scheduleEmbed() {
    const currentSch = await db.manyOrNone(
        `SELECT * from "${LIVEMATCHUPS}" ORDER BY "startTime" ASC`,
    )
    // #  currentSch will be an array of objects for the games currently stored.
    // ? Use Lodash to create a simple string containing the teams, odds & start time.
    const currentSchString = _.map(currentSch, (game) => {
        return `\n**• ${game.teamone}** *(${game.teamoneodds})* vs. **${game.teamtwo}** *(${game.teamtwoodds})* | **${game.legiblestart}**`
    })
    const embed = {
        title: `Games Scheduled`,
        description: `${currentSchString}\n\n*${container.matchupCount} games total.*`,
        color: '#a0b9f3',
        target: `modBotSpamID`,
        footer: `All game channels will be created 1 hour ahead of their start (EST)`,
    }
    return embed
}
