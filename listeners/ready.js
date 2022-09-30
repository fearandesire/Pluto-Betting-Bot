import { Listener } from '@sapphire/framework'
import { Log } from '#LogColor'
import { completedReq } from '../utils/api/completedReq.js'
import { createRequire } from 'module'
import { embedReply } from '#config'
import { resolveToday } from './../utils/date/resolveToday.js'
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
    var todayInfo = await new resolveToday()
    let completedCheckTime
    let gameDay
    if (todayInfo.dayOfWeek.toLowerCase() === `sun`) {
        completedCheckTime = `<t:1664132400:t>` //* 3:00 PM EST
        gameDay = true
    } else if (todayInfo.dayOfWeek.toLowerCase() === `mon`) {
        completedCheckTime = `<t:1664244000:T>` //* 2:00 PM EST
        gameDay = true
    } else if (todayInfo.dayOfWeek.toLowerCase() === `thur`) {
        completedCheckTime = `<t:1664244000:T>` //* 10:00 PM EST
        gameDay = true
    }
    await scheduleReq().then(() => {
        var embedObj = {
            title: `Schedule Queue`,
            description: `Weekly Schedule Gathering Information: **Every <t:1664258400:F>**`,
            color: '#00ff00',
            target: 'modBotSpamID',
            footer: 'Pluto | Designed by FENIX#7559',
        }
        embedReply(null, embedObj)
    })
    if (gameDay === true) {
        await completedReq().then(() => {
            var embedObj = {
                title: `Game Day Queue`,
                description: `Initiated the game completed queue!\nChecking for completed games today: **every 5 minutes after ${completedCheckTime}**`,
                color: '#00ff00',
                target: 'modBotSpamID',
                footer: 'Pluto | Designed by FENIX#7559',
            }
            embedReply(null, embedObj)
        })
    }
}, 5000)
Log.Green(`[Startup]: On-Load Processes started!`)
