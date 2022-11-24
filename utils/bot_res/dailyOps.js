import cron from 'node-cron'
import { embedReply } from '#config'
import { memUse } from '#mem'
import { sentSchEmb } from '../cache/sentSchEmb.js'

/**
 * @module dailyOps
 * Check for game days to let us know what time we will start checking for completed games.
 */

export async function dailyOps() {
    await memUse(`dailyOps`, `Pre-Cron`)
    cron.schedule('0 0 * * *', async () => {
        await sentSchEmb().then(async (res) => {
            if (res == false) {
                var embedObj = {
                    title: `Schedule Queue`,
                    description: `Weekly Schedule Gathering Information: **Every Tuesday @ <t:1664863200:T>**`,
                    color: '#00ff00',
                    target: 'modBotSpamID',
                    footer: 'Pluto | Designed by FENIX#7559',
                }
                await embedReply(null, embedObj)
            }
        })
    })
    await memUse(`dailyOps`, `Post-Cron`)
}
