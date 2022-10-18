import { _, embedReply } from '#config'

import flatcache from 'flat-cache'
import { resolveDayName } from './resolveDayName.js'
import { resolveToday } from '#dateUtil/resolveToday'

/** 
@module gameDayCron
Initiate a Cron Job to run at midnight to check if today is a game day. On Game Days, send an embed to remind when we will check for completed games.
*/

export async function gameDayCron() {
    var todayInfo = await new resolveToday()
    var todaysDay = new Date().getDay()
    var dayOfWeek = await resolveDayName(todaysDay)
    let completedCheckTime
    var gameEmbedCheck = flatcache.create(`gDayEmbedCache.json`, `./cache/`)
    let gameDay
    var gameDayCache = flatcache.load('gameDaysCache.json', './cache/')
    var gameDays = gameDayCache.getKey('gameDays')
    var hasSentEmbed = gameEmbedCheck.getKey(dayOfWeek)
    //# iterate game days cache and check if today is a game day
    if (_.includes(gameDays, dayOfWeek)) {
        gameDay = true
    } else {
        gameDay = false
    }
    if (gameDay === true && hasSentEmbed !== true) {
        var embedObj = {
            title: `Game Day!`,
            description: `Checking for completed games today: **every 5 minutes after ${completedCheckTime}**`,
            color: '#00ff00',
            target: 'modBotSpamID',
            footer: 'Pluto | Designed by FENIX#7559',
        }
        await gameEmbedCheck.setKey(todayInfo.todayFullEasy, true)
        await gameEmbedCheck.save(true)
        await embedReply(null, embedObj)
    } else {
        return
    }
}
