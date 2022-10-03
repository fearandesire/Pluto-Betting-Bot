import { Listener } from '@sapphire/framework'
import { Log } from '#LogColor'
import { completedReq } from '../utils/api/completedReq.js'
import { createRequire } from 'module'
import { embedReply } from '#config'
import { gameDayCron } from '#botUtil/gameDayCron'
import { scheduleReq } from '#api/scheduleReq'
import { sentSchEmb } from '../utils/cache/sentSchEmb.js'

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
    await sentSchEmb().then(async (res) => {
        if (res === false) {
            await scheduleReq().then(async () => {
                var embedObj = {
                    title: `Schedule Queue`,
                    description: `Weekly Schedule Gathering Information: **Every Tuesday @ <t:1664863200:T>**`,
                    color: '#00ff00',
                    target: 'modBotSpamID',
                    footer: 'Pluto | Designed by FENIX#7559',
                }
                await embedReply(null, embedObj)
            })
        }
    })
    await completedReq().then(() => {
        Log.Green(`Game Complete Check Cron Que Initiated`)
    })
    await gameDayCron()
}, 5000)

Log.Green(`[Startup]: On-Load Processes started!`)
