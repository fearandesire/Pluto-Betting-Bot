import { Log } from '../bot_res/send_functions/consoleLog.js'
import { db } from '../../Database/dbindex.js'
import { embedReply } from './../bot_res/send_functions/embedReply.js'

/**
 * @module matchupscreate -
 * Manually create a new matchup in the DB
 * @description - This function will take in the parameters listed below and populate a row in the DB into 'activematchups' with said parameters.
 * @param {obj} message - The message object containing the user & their message - also used to reference a direct reply to the user with message.reply()
 * @param {string} teamone - The first team in the matchup (user input)
 * @param {string} teamtwo - The second team in the matchup (user input)
 * @param {integer} teamoneodds - The odds of the first team (user input)
 * @param {integer} teamtwoodds - The odds of the second team (user input)
 * @param {integer} assignMatchupIds - The id of the matchup (automatically generated)
 * @references {@link createMatchup.js} - This module is called from createMatchup.js - the command responsible for manually initiating a new matchup.
 */
export async function matchupscreate(
    message,
    teamone,
    teamtwo,
    teamoneodds,
    teamtwoodds,
    assignMatchupIds,
) {
    Log.Yellow(`[matchupscreate.js] Running matchupscreate!`)

    db.none(
        `INSERT INTO activematchups (matchid, teamone, teamtwo, teamoneodds, teamtwoodds) VALUES ($1, $2, $3, $4, $5)`,
        [assignMatchupIds, teamone, teamtwo, teamoneodds, teamtwoodds],
    )
        .then((output) => {
            var matchupEmbedObj = {
                title: 'Matchup Created',
                description: `**__Matchup Details__**\n__Matchup ID:__ **${assignMatchupIds}**\n\n**__Teams @ Odds__**\n__Home Team:__ **__${teamone}__** @ *${teamoneodds}*\n__Away Team:__ **__${teamtwo}__** - *${teamtwoodds}*`,
                color: 'GREEN',
            }
            embedReply(message, matchupEmbedObj)
            return
        })
        .catch((err) => {
            Log.Error(
                `[matchupscreate.js.js] Error adding matchup to matchupscreate table\n${err}`,
            )
        })
}
