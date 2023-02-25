// import flatcache from 'flat-cache'

import { Log, LIVEMATCHUPS, _, container, flatcache } from '#config'

import { cronMath } from './cronMath.js'
import { db } from '#db'
import dmMe from '../../bot_res/dmMe.js'
import { msgBotChan } from '#botUtil/msgBotChan'
import { resolveToday } from '#dateUtil/resolveToday'
import { scheduleChannels } from './scheduleChannels.js'

/**
 * @module fetchSchedule
 * 1. Retrieve all matchup information for the day via the dailyOdds cache file
 * 2. Iterate through the matchups and spawn the Cron Jobs to create a game channel for each matchup with the home team, away team and cronStartTime
 * {@link callSchedule (fetchOdds command)}
 */

export async function fetchSchedule(interaction) {
    if (container.fetchedAlready === true) {
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
    const checkDB = await db
        .manyOrNone(`SELECT * FROM "${LIVEMATCHUPS}"`)
        .then(async (data) => {
            if (_.isEmpty(data)) {
                Log.Red(`No active matchups found in the database.`)
                return false
            }
            container.numOfMatchups = data.length
            for await (const [key, value] of Object.entries(data)) {
                const homeTeam = value.teamone
                const awayTeam = value.teamtwo
                const cronStartTime = value.cronstart
                const legibleStartTime = value.legiblestart
                const startTimeISO = value.startTime
                // # Subtract 1 hour from the the cron start time to open the game channel an hour before the game starts
                const newCron = await new cronMath(cronStartTime).subtract(1, `hours`)
                console.log(
                    `Home Team: ${homeTeam}\nAway Team: ${awayTeam}\nCron Start Time: ${newCron}\nLegible Start Time: ${legibleStartTime}\nStart Time ISO: ${startTimeISO}`,
                )
                await scheduleChannels(homeTeam, awayTeam, newCron, legibleStartTime)
            }
        })
    if (checkDB === false) {
        await dmMe(
            `No active matchups found in the database, no games have been scheduled.`,
        )
        return
    }
    const today = await new resolveToday().todayFullSlashes
    const cache = flatcache.create(`queuedEmbed.json`, `./cache`)
    if (cache.getKey(`hasSent-${today}`)) {
        console.log(
            `[fetchSchedule.js] Game Channel Queue Embed has already been sent.`,
        )
    } else {
        const embObj = {
            title: `Game Channels Queue`,
            color: `#ff00ff`,
            description: `Successfully queued game channels to be created for the games in the day at their scheduled times :white_check_mark: `,
            footer: `${container.numOfMatchups} game channels will be created | This is based on the current matchups in the database.`,
            target: `modBotSpamID`,
        }
        cache.setKey(`hasSent-${today}`, true)
        cache.save()
        // # This function can be called from a command, or on start-up. So no interaction would indicate that it was called from start-up.
        if (!interaction) {
            await dmMe(
                `${container.numOfMatchups} game channels have been queued to be created for the day.`,
            )
        } else {
            delete embObj.target
            await interaction.followUp({ embeds: [embObj] })
        }
        container.fetchedAlready = true
        Log.Green(
            `Successfully fetched the game data from the DB and scheduled the game channels`,
        )
    }
}
