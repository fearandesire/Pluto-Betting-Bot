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

setTimeout(async () => {
    //# Queue checking for weekly games schedule
    await scheduleReq()
    //# Queue game channel scheduling
    await fetchSchedule()
    //# Queue checking for completed games
    await completedReq().then(() => {
        Log.Green(`Game Completed Check Cron Job Initiated`)
    })
    //# Daily Embeds
    await dailyOps().then(() => {
        Log.Green(`Daily Embeds Initiated`)
    })
}, 5000)

Log.Green(`[Startup]: On-Load Processes started!`)
