import { SCHEDULE_TIMER } from '#config'
import { collectOdds } from './collectOdds.js'
import { createRequire } from 'module'
import { removeAllMatchups } from '#utilMatchups/removeAllMatchups'

const require = createRequire(import.meta.url)
import { debugLog, labelMsg } from './../logging.js'
import { checkCompleted } from './checkCompleted.js'

const cron = require('node-cron')

/** 
@module scheduleReq 
Executed daily, setup a sequence of Cron Jobs to call the API and collect odds for games.
Cron Jobs here are defined inside of the `.env` file; But they are based on weekly for NFL, and daily for NBA.
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
                    return
                })
                return
            })
        },
        { timezone: 'America/New_York' },
    )
}
