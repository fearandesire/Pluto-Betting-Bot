import { NFL_CRON_MON, NFL_CRON_SUN, NFL_CRON_THUR } from '#config'

import { checkCompleted } from './checkCompleted.js'
import { completedReqLog } from './../logging.js'
import { createRequire } from 'module'

//import { NBA_CRON_9PM, NBA_CRON5TO7PM } from '#config'
const require = createRequire(import.meta.url)
const cron = require('cronitor')(`f9f7339479104e79bf2b52eb9c2242bf`)
cron.wraps(require('node-cron'))
const compGameMonitor = new cron.Monitor('Completed Game Monitor')

/**
 * @module completedReq -
 * Setup a sequence of  API Calls to check for completed games every 15 minutes starting from the earliest NFL Game Times.
 * According to the NFL Schedule. Mondays, Thursdays & Sundays are game days
 * Schedule Times stay consistent:
 * - Monday: 10:00  PM
 * - Sunday; 3:00 PM
 * - Thursday 10:00 PM
 */

export async function completedReq() {
    completedReqLog.info(`Running completedReq.js - Initializing Cron Jobs`)
    compGameMonitor.ping({
        state: `ok`,
        message: `Initializing finished game check Cron Job [completedReq.js]`,
    })
    //let thursTimer = `*/1 * * * *`
    let thursTimer = `${NFL_CRON_THUR}`
    cron.schedule(
        `thursdayCheckGames`,
        `${thursTimer}`,
        async () => {
            completedReqLog.info(`Checking for completed games..`)
            compGameMonitor.ping({
                state: 'run',
                message: `Checking for completed games..`,
            })
            await checkCompleted(compGameMonitor)
        },
        { timezone: 'America/New_York' },
    )
    let sundayTimer = `${NFL_CRON_SUN}`
    cron.schedule(
        `sundayCheckGames`,
        `${sundayTimer}`,
        async () => {
            completedReqLog.info(`Checking for completed games..`)
            compGameMonitor.ping({
                state: 'run',
                message: `Checking for completed games..`,
            })
            await checkCompleted(compGameMonitor)
        },
        { timezone: 'America/New_York' },
    )
    let monTimer = `${NFL_CRON_MON}`
    cron.schedule(
        `mondayCheckGames`,
        `${monTimer}`,
        async () => {
            completedReqLog.info(`Checking for completed games..`)
            compGameMonitor.ping({
                state: 'run',
                message: `Checking for completed games..`,
            })
            await checkCompleted(compGameMonitor)
        },
        { timezone: 'America/New_York' },
    )
}
