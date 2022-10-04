import { checkCompleted } from './checkCompleted.js'
import { completedReqLog } from './../logging.js'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const cron = require('cronitor')(`f9f7339479104e79bf2b52eb9c2242bf`)
cron.wraps(require('node-cron'))
const compGameMonitor = new cron.Monitor('Completed Game Monitor')

/**
 * @module completedReq -
 * Setup a sequence of  API Calls to check for completed games every 15 minutes starting from the earliest NFL Game Times.
 * According to the NFL Schedule. Mondays, Thursdays & Sundays are game days
 * Schedule Times stay consistent:
 * - Monday: 2:00  PM
 * - Sunday; 3:00 PM
 * - Thursday 10:00 PM
 */

export async function completedReq() {
    completedReqLog.info(`Running completedReq.js - Initializing Cron Jobs`)
    compGameMonitor.ping({
        state: `ok`,
        message: `Initializing schedule check Cron Job`,
    })
    //let thursTimer = `*/1 * * * *`
    let thursTimer = `*/5 22-23 * * thur`
    cron.schedule(
        `thursdayCheckGames`,
        `${thursTimer}`,
        async () => {
            completedReqLog.info(`Checking for completed games..`)
            compGameMonitor.ping({ state: 'run' })
            await checkCompleted()
        },
        { timezone: 'America/New_York' },
    )
    let sundayTimer = `*/2 15-23 * * sun`
    cron.schedule(
        `sundayCheckGames`,
        `${sundayTimer}`,
        async () => {
            completedReqLog.info(`Checking for completed games..`)
            compGameMonitor.ping({ state: 'run' })
            await checkCompleted()
        },
        { timezone: 'America/New_York' },
    )
    let monTimer = `*/1 00-03 * * tues`
    cron.schedule(
        `mondayCheckGames`,
        `${monTimer}`,
        async () => {
            completedReqLog.info(`Checking for completed games..`)
            compGameMonitor.ping({ state: 'run' })
            await checkCompleted()
        },
        { timezone: 'America/New_York' },
    )
    // let earlyMon = `*/5 00-04 * * mon`
    // cron.schedule(
    //     `earlyMonday`,
    //     `${earlyMon}`,
    //     async () => {
    //         completedReqLog.info(`Checking for completed games..`)
    //         compGameMonitor.ping({ state: 'run' })
    //         await checkCompleted()
    //     },
    //     { timezone: 'America/New_York' },
    // )
}
