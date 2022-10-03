import { embedReply } from '#config'
import flatcache from 'flat-cache'
import { resolveToday } from '#dateUtil/resolveToday'

/** 
@module gameDayCron
Initiate a Cron Job to run at midnight to check if today is a game day. On Game Days, send an embed to remind when we will check for completed games.
*/

export async function gameDayCron() {
    var todayInfo = await new resolveToday()
    let completedCheckTime
    var gameEmbedCheck = flatcache.create(`gDayEmbedCache.json`, `./cache/`)
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
    if (gameDay === true) {
        if (gameEmbedCheck.getKey(todayInfo.todayFullEasy) !== true) {
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
}
