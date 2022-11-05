import { addMinutes, format } from 'date-fns'

import cron from 'node-cron'
import { dmMe } from '../../bot_res/dmMe.js'
import { msgBotChan } from '#botUtil/msgBotChan'

/**
 * @module queueDeleteChannel
 * Create a Cron Job to delete a channel 30 minutes from now. Current time is fetched with date-fns
 */
export async function queueDeleteChannel(gameChan) {
    var rn = new Date()
    var currMin = addMinutes(rn, 30)
    var newMinRaw = format(currMin, 'HH:mm:dd')
    var splitTime = newMinRaw.split(':')
    var newMin = splitTime[1]
    var newHour = splitTime[0]
    var currDay = splitTime[2]
    var currMonth = splitTime[3]
    var cronString = `${newMin} ${newHour} ${currDay} ${currMonth} *`
    await dmMe(`Deleting ${gameChan} in 30 minutes`)
    cron.schedule(cronString, async () => {
        await console.log(`Creating Cron Job to delete channel ${gameChan}`)
        try {
            await gameChan.delete()
            await msgBotChan(`Deleted ${gameChan.name}`)
        } catch (error) {
            console.log(`Unable to delete game channel ${gameChan} >>\n`, error)
        }
    })
}
