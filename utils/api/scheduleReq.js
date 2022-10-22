import { collectOdds } from './collectOdds.js'
import { createRequire } from 'module'
import currentWeekNumber from 'current-week-number'
import { flatcache } from '#config'
import { removeAllMatchups } from '#utilMatchups/removeAllMatchups'
import { scheduleReqLog } from '../logging.js'

const require = createRequire(import.meta.url)

const cron = require('cronitor')(`f9f7339479104e79bf2b52eb9c2242bf`)
cron.wraps(require('node-cron'))

/** 
@module scheduleReq 
the-odds-api seems to only update their odds every day, and provide the odds for the same-day games, not the future, like the NFL version does.
*/

export async function scheduleReq() {
    let schReqCache = await flatcache.create(
        `lastWeekCalled.json`,
        './cache/scheduleReq',
    )
    let lastWeekCalled = schReqCache.getKey('lastWeekCalled')
        ? schReqCache.getKey('weekCalledLast')
        : schReqCache.setKey(`weekCalledLast`, 'empty')

    cron.schedule(
        `collectMatchupsReq`,
        `0 2 * * tue`,
        async () => {
            scheduleReqLog.info(`Verifying if we have reached a new week...`)
            var currentWeek = currentWeekNumber()
            if (lastWeekCalled !== currentWeek) {
                scheduleReqLog.info(
                    `Detected a new week! Currently calling this week's odds from the API`,
                )
                await removeAllMatchups().then(async () => {
                    await collectOdds()
                    lastWeekCalled = currentWeek
                    schReqCache.setKey(`weekCalledLast`, currentWeek)
                    schReqCache.save(true)
                    return
                })
            } else {
                scheduleReqLog.info(
                    `This week is the same as last week collected. No need to call the API for new games`,
                )
                return
            }
        },
        { timezone: 'America/New_York' },
    )
}
