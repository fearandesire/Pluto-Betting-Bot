import { Log, gamesScheduled } from '#config'

import { createChannel } from './createChannel.js'
import { createRequire } from 'module'
import { getShortName } from './../../bot_res/getShortName.js'
import { scheduleChanLog } from '#winstonLogger'

const require = createRequire(import.meta.url)
const cron = require('cronitor')(`f9f7339479104e79bf2b52eb9c2242bf`)
cron.wraps(require('node-cron'))
const schedChanMonitor = new cron.Monitor('Schedule Game Channels')

/**
 * @module scheduleChannels
 * Use the Cron Time created from {@link collectOdds} to schedule the game channel creation for each game.
 * If the bot is reset, another function will be made to fetch the cron times from the database and pass them to this function.
 */

export async function scheduleChannels(
    homeTeam,
    awayTeam,
    cronStartTime,
    legibleStartTime,
) {
    homeTeam = await getShortName(homeTeam)
    awayTeam = await getShortName(awayTeam)
    await schedChanMonitor.ping({
        state: `run`,
        message: `Creating a Cron Job to create a game channel for: ${awayTeam} vs ${homeTeam} | Cron Time: ${cronStartTime}`,
    })
    await Log.Yellow(
        `Creating a Cron Job to create a game channel for: ${awayTeam} vs ${homeTeam} | Cron Time: ${cronStartTime}`,
    )
    await scheduleChanLog.info(
        `Creating a Cron Job to create a game channel for: ${awayTeam} vs ${homeTeam} | Cron Time: ${cronStartTime}`,
    )
    var createCron = async () => {
        await cron.schedule(
            `${awayTeam} vs ${homeTeam}`,
            `${cronStartTime}`,
            async () => {
                await createChannel(awayTeam, homeTeam)
            },
            { timezone: 'America/New_York' },
        )
    }
    await createCron().then(async () => {
        await schedChanMonitor.ping({
            state: `complete`,
            message: `Successfully created Cron Job to create a game channel for: ${awayTeam} vs ${homeTeam} | Cron Time: ${cronStartTime}`,
        })
        await Log.Green(
            `Successfully created Cron Job to create a game channel for: ${awayTeam} vs ${homeTeam} | Cron Time: ${cronStartTime}`,
        )
        await scheduleChanLog.info(
            `Successfully created Cron Job to create a game channel for: ${awayTeam} vs ${homeTeam} | Cron Time: ${cronStartTime}`,
        )
        gamesScheduled.push(`• ${awayTeam} vs ${homeTeam} | ${legibleStartTime}`)
        return
    })
}
