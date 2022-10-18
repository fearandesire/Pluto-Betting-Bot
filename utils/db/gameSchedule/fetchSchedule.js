//import flatcache from 'flat-cache'

import { Log, _ } from '#config'

import { MessageEmbed } from 'discord.js'
import { container } from '#config'
import { db } from '#db'
import { scheduleChannels } from './scheduleChannels.js'

/**
 * @module fetchSchedule
 * 1. Retrieve all matchup information for the week via the weeklyOddds cache file
 * 2. Iterate through the matchups and spawn the Cron Jobs to create a game channel for each matchup with the home team, away team and cronStartTime
 */

export async function fetchSchedule(interaction) {
    if (container.fetchedAlready == true) {
        await interaction.followUp({
            content: `Game channels have already been scheduled.`,
        })
        return
    }
    await db.manyOrNone(`SELECT * FROM activematchups`).then(async (data) => {
        if (_.isEmpty(data)) {
            Log.Red(`No active matchups found in the database.`)
            return
        } else {
            container.numOfMatchups = data.length
            for await (let [key, value] of Object.entries(data)) {
                var homeTeam = value.teamone
                var awayTeam = value.teamtwo
                var startTime = value.cronstart
                await scheduleChannels(homeTeam, awayTeam, startTime)
            }
        }
    })
    var embed = new MessageEmbed()
        .setTitle(`Game Channels Queue`)
        .setDescription(
            `Successfully queued game channels to be created for the games in the week at their scheduled times :white_check_mark: `,
        )
        .setFooter(
            `${container.numOfMatchups} game channels will be created | This is based on the current matchups in the database.`,
        )
        .setColor(`#00FF00`)
    await interaction.followUp({ embeds: [embed] })
    container.fetchedAlready = true
    Log.Green(
        `Successfully fetched the game data from the DB and scheduled the game channels`,
    )
}
