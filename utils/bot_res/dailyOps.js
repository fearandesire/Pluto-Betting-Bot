import cron from 'node-cron'
import { embedReply } from '#config'
import { gameDayCron } from '#botUtil/gameDayCron'
import { sentSchEmb } from '../cache/sentSchEmb.js'

/**
 * @module dailyOps
 * Check for game days to let us know what time we will start checking for completed games.
 */

export async function dailyOps() {
    cron.schedule('0 0 * * *', async () => {
        await sentSchEmb().then(async (res) => {
            if (res == false) {
                var embedObj = {
                    title: `Matchup & Schedule Queue`,
                    description: `Daily Game Matchup/Schedule Gathering Information: **Everyday @ <t:1666526400:t>**`,
                    color: '#00ff00',
                    target: 'modBotSpamID',
                    footer: 'Pluto | Designed by FENIX#7559',
                }
                await embedReply(null, embedObj)
            }
        })
        await gameDayCron()
    })
}
