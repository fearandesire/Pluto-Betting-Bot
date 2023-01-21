import { Listener } from '@sapphire/framework'
import { Log } from '#LogColor'
import { completedReq } from '../utils/api/completedReq.js'
import { createRequire } from 'module'
import { dailyOps } from '../utils/bot_res/dailyOps.js'
import { fetchSchedule } from '../utils/db/gameSchedule/fetchSchedule.js'
import { scheduleReq } from '#api/scheduleReq'

const require = createRequire(import.meta.url)
const cron = require('cronitor')(`f9f7339479104e79bf2b52eb9c2242bf`)
cron.wraps(require('node-cron'))

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
    //# Queue Cron for for games schedule
    await scheduleReq()
    //# Restart Operation: Check for game channels to be scheduled on restart
    if (process.env.envMode == 'Online') {
        await fetchSchedule()
    }
    //# Queue Daily Cron to create more Crons related to games
    await new completedReq().dailyCheck().then(() => {
        Log.Green(
            `[ready] Called \`completedReq\` to initialize the daily 'resolveCompCron' Cron Job ->\nCron Time: ${process.env.CHECK_COMPLETED_TIMER}`,
        )
    })
}, 5000)

Log.Green(`[Startup]: On-Load Processes started!`)
