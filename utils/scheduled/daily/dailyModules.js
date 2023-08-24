import { format } from 'date-fns'
import { createRequire } from 'module'
import Promise from 'bluebird'
import { db } from '#db'
import { LIVEMATCHUPS, RANGES } from '#env'
import { Log, _, SCHEDULE_TIMER, isPreSzn } from '#config'
import { removeAllMatchups } from '#utilMatchups/removeAllMatchups'
import collectOdds from '../../api/collectOdds.js'
import { debugLog, labelMsg } from '../../logging.js'
import { checkCompleted } from '../../api/checkCompleted.js'
import { preseasonGameHeartbeat } from '../../api/gameHeartbeat.js'
import schedulePreseasonGames from '../../db/gameSchedule/schedulePreseasonGames.js'
import {
    cronChanScheduler,
    cronHeartbeat,
} from '../scheduledModules.js'
import logClr from '#colorConsole'

const require = createRequire(import.meta.url)
const cron = require('node-cron')

/** 
@module scheduleReq 
Executed daily, setup a sequence of Cron Jobs to call the API and collect odds for games.
The timer is based on weekly schedule rotation for NFL, and daily for NBA [Regular Season]
*/

export async function scheduleReq() {
    cron.schedule(
        `${SCHEDULE_TIMER}`,
        async () => {
            await debugLog.info(
                labelMsg(
                    `scheduleReq`,
                    `Closing any existing bets before collecting new odds.`,
                ),
            )

            await checkCompleted().then(async () => {
                await removeAllMatchups().then(async () => {
                    await collectOdds()
                })
            })
        },
        { timezone: 'America/New_York' },
    )
}
/**
 * Executed at the top of the day, daily.
 */
export async function dbDailyOps() {
    logClr({
        text: `Starting daily operations`,
        color: `yellow`,
        status: `processing`,
    })
    try {
        if (isPreSzn) {
            await Promise.all([
                await cronHeartbeat(), // Check for completed games via heartbeat
                await schedulePreseasonGames(), // Queue games to be made now, in case bot is restarted at an odd time
                await cronChanScheduler(true),
            ])
        } else {
            await Promise.all([
                await checkCompleted(),
                await removeAllMatchups(),
                await collectOdds(),
            ])
        }
    } catch (err) {
        Log.Red(err)
    }
}
