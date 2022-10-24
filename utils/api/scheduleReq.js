import { collectOdds } from './collectOdds.js'
import { createRequire } from 'module'
import { flatcache } from '#config'
import { removeAllMatchups } from '#utilMatchups/removeAllMatchups'

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
    cron.schedule(
        `collectMatchupsReq`,
        `0 10 * * *`,
        async () => {
            await removeAllMatchups().then(async () => {
                await collectOdds()
                return
            })
        },
        { timezone: 'America/New_York' },
    )
}
