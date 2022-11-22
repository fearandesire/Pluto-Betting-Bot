import { addMinutes, format } from 'date-fns'

import cron from 'node-cron'
import { deleteChan } from './deleteChan.js'
import { dmMe } from '../../bot_res/dmMe.js'

/**
 * @module queueDeleteChannel
 * Create a Cron Job to delete a channel x minutes from now. Current time is fetched with date-fns
 */
export async function queueDeleteChannel(gameChan) {
    var rn = new Date()
    var currMin = addMinutes(rn, 30) // format current time + x minutes
    var newMinRaw = format(currMin, 's mm H d M i')
    var splitTime = newMinRaw.split(' ')
    var secs = splitTime[0]
    var mins = splitTime[1]
    var hours = splitTime[2]
    var day = splitTime[3]
    var month = splitTime[4]
    var dayOfWeek = splitTime[5]
    var cronString = `0 ${mins} ${hours} ${day} ${month} ${dayOfWeek}`
    console.log(`new min raw: ${newMinRaw} | cronString: ${cronString}`)
    await dmMe(`Deleting ${gameChan} in 30 minutes`)
    await console.log(`Creating Cron Job to delete channel: ${gameChan}`)
    cron.schedule(cronString, async () => {
        try {
            await deleteChan(gameChan).then(async (res) => {
                if (res) {
                    await dmMe(`Deleted ${gameChan}`)
                    return true
                } else {
                    await dmMe(`Ran into trouble when trying to delete: ${gameChan}`)
                    return false
                }
            })
        } catch (error) {
            await dmMe(`Error deleting ${gameChan.name}`)
            console.log(`Unable to delete game channel ${gameChan} >>\n`, error)
            throw new Error(`Unable to delete game channel ${gameChan} >>\n`, error)
        }
    })
}
