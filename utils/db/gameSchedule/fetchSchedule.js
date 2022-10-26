//import flatcache from 'flat-cache'

import { Log, NFL_ACTIVEMATCHUPS, _, container, flatcache } from '#config'

import { MessageEmbed } from 'discord.js'
import { cronMath } from './cronMath.js'
import { db } from '#db'
import { embedReply } from '#embed'
import { msgBotChan } from '#botUtil/msgBotChan'
import { resolveToday } from '#dateUtil/resolveToday'
import { scheduleChannels } from './scheduleChannels.js'

/**
 * @module fetchSchedule
 * 1. Retrieve all matchup information for the day via the weeklyOdds cache file
 * 2. Iterate through the matchups and spawn the Cron Jobs to create a game channel for each matchup with the home team, away team and cronStartTime
 */

export async function fetchSchedule(interaction) {
    if (container.fetchedAlready == true) {
        if (!interaction) {
            await msgBotChan(
                `Game channels have already been queued to be created for the day.`,
            )
            return
        }
        await interaction.followUp({
            content: `Game channels have already been scheduled.`,
        })
        return
    }
    var checkDB = await db
        .manyOrNone(`SELECT * FROM "${NFL_ACTIVEMATCHUPS}"`)
        .then(async (data) => {
            if (_.isEmpty(data)) {
                Log.Red(`No active matchups found in the database.`)
                return false
            } else {
                container.numOfMatchups = data.length
                for await (let [key, value] of Object.entries(data)) {
                    var homeTeam = value.teamone
                    var awayTeam = value.teamtwo
                    var cronStartTime = value.cronstart
                    var legibleStartTime = value.legiblestart
                    var startTimeISO = value.startTime
                    //# Subtract 1 hour from the the cron start time to open the game channel an hour before the game starts
                    var newCron = await new cronMath(cronStartTime).subtract(1, `hours`)
                    console.log(
                        `Home Team: ${homeTeam}\nAway Team: ${awayTeam}\nCron Start Time: ${newCron}\nLegible Start Time: ${legibleStartTime}\nStart Time ISO: ${startTimeISO}`,
                    )
                    await scheduleChannels(homeTeam, awayTeam, newCron, legibleStartTime)
                }
            }
        })
    if (checkDB == false) {
        await msgBotChan(
            `No active matchups found in the database, no games have been scheduled.`,
        )
        return
    }
    var today = await new resolveToday().todayFullSlashes
    var cache = flatcache.create(`queuedEmbed.json`, `./cache`)
    if (cache.getKey(`hasSent-${today}`)) {
        console.log(
            `[fetchSchedule.js] Game Channel Queue Embed has already been sent.`,
        )
        return
    } else {
        var embed = new MessageEmbed()
            .setTitle(`Game Channels Queue`)
            .setDescription(
                `Successfully queued game channels to be created for the games in the day at their scheduled times :white_check_mark: `,
            )
            .setFooter(
                `${container.numOfMatchups} game channels will be created | This is based on the current matchups in the database.`,
            )
            .setColor(`#00FF00`)
        var embObj = {
            title: `Game Channels Queue`,
            description: `Successfully queued game channels to be created for the games in the day at their scheduled times :white_check_mark: `,
            footer: `${container.numOfMatchups} game channels will be created | This is based on the current matchups in the database.`,
            target: `modBotSpamID`,
        }
        cache.setKey(`hasSent-${today}`, true)
        cache.save()
        if (!interaction) {
            await embedReply(null, embObj)
        } else {
            await interaction.followUp({ embeds: [embed] })
        }
        container.fetchedAlready = true
        Log.Green(
            `Successfully fetched the game data from the DB and scheduled the game channels`,
        )
    }
}
