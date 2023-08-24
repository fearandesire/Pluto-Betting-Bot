import { Listener } from '@sapphire/framework'
import { createRequire } from 'module'
import { Log } from '#LogColor'
import { spinner, SEASON_TYPE } from '#config'
import { fetchSchedule } from '../utils/db/gameSchedule/fetchSchedule.js'
import { rangeRefresh } from '../utils/db/matchupOps/matchupManager.js'
import schedulePreseasonGames from '../utils/db/gameSchedule/schedulePreseasonGames.js'
import { preseasonGameHeartbeat } from '../utils/api/gameHeartbeat.js'
import logClr from '../utils/bot_res/ColorConsole.js'
import { dbDailyOps } from '../utils/scheduled/daily/dailyModules.js'

// eslint-disable-next-line no-unused-vars
export class ReadyListener extends Listener {
    constructor(context, options) {
        super(context, {
            ...options,
            once: true,
            event: 'ready',
        })
    }

    run(SapDiscClient) {
        const {
            username, // eslint-disable-line
            id, // eslint-disable-line
        } = SapDiscClient.user
    }
}
/** On a timeout to ensure bot is logged in. */
setTimeout(async () => {
    logClr({
        text: `Running On-Load Processes`,
        color: `yellow`,
        mark: `🕒`,
    })
    // # Restart Operation: Check for game channels to be scheduled on restart
    if (process.env.NODE_ENV === 'production') {
        if (SEASON_TYPE !== 'preseason') {
            // # Queue Cron for for games schedule
            //   await scheduleReq()
            //        await fetchSchedule()
            await rangeRefresh()
        } else {
            // await schedulePreseasonGames()
            await dbDailyOps()
        }
        logClr({
            text: `[Startup]: On-Load Processes completed!`,
            mark: `✅`,
            color: `green`,
        })
    }
}, 5000)
