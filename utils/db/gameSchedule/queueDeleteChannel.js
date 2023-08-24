import { addMinutes, format } from 'date-fns'

import cron from 'node-cron'
import { deleteChan } from './deleteChan.js'
import dmMe from '../../bot_res/dmMe.js'

/**
 * @module queueDeleteChannel
 * Create a Cron Job to delete a channel x minutes from now. Current time is fetched with date-fns
 */
export async function queueDeleteChannel(gameChanName) {
    const rn = new Date()
    const currMin = addMinutes(rn, 30) // format current time + x minutes
    const newMinRaw = format(currMin, 's mm H d M i')
    const splitTime = newMinRaw.split(' ')
    const secs = splitTime[0]
    const mins = splitTime[1]
    const hours = splitTime[2]
    const day = splitTime[3]
    const month = splitTime[4]
    const dayOfWeek = splitTime[5]
    const cronString = `0 ${mins} ${hours} ${day} ${month} ${dayOfWeek}`
    await dmMe(`Deleting ${gameChanName} in 30 minutes`)
    cron.schedule(cronString, async () => {
        try {
            await deleteChan(gameChanName).then(
                async (res) => {
                    if (res) {
                        await dmMe(
                            `Deleted ${gameChanName}`,
                        )
                        return true
                    }
                    await dmMe(
                        `Ran into trouble when trying to delete: ${gameChanName}`,
                    )
                    return false
                },
            )
        } catch (error) {
            await dmMe(
                `Error deleting ${gameChanName.name}`,
            )
            console.log(
                `Unable to delete game channel ${gameChanName} >>\n`,
                error,
            )
            throw new Error(
                `Unable to delete game channel ${gameChanName} >>\n`,
                error,
            )
        }
    })
}
