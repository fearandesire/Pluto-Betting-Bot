import { createRequire } from 'module'
import { SCHEDULE_TIMER } from '#config'
import { collectOdds } from './collectOdds.js'
import { removeAllMatchups } from '#utilMatchups/removeAllMatchups'
import { debugLog, labelMsg } from '../logging.js'
import { checkCompleted } from './checkCompleted.js'

const require = createRequire(import.meta.url)

const cron = require('node-cron')

/** 
@module scheduleReq 
Executed daily, setup a sequence of Cron Jobs to call the API and collect odds for games.
The timer for this cron job (@var SCHEDULE_TIMER) is defined in the .env for the related sport.
The timer is based on weekly schedule rotation for NFL, and daily for NBA.
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
