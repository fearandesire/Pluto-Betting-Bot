import { _, embedReply } from '#config'

import { NBA_completedCheckTimes } from '#config'
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
    var sentGameDayEmbed = flatcache.create(
        `gDayEmbedCache.json`,
        `./cache/dailyembeds`,
    )
    var gameDaysArr = flatcache.create('gameDaysArr.json', './cache/dailyembeds')
    var gameDays = gameDaysArr.getKey('gameDays')
    var hasSentEmbed =
        sentGameDayEmbed.getKey(dayOfWeek) == undefined ? false : true
    var isGameDay = _.includes(gameDays, dayOfWeek)
    console.log(
        `[gameDayCron]:\nToday is ${dayOfWeek}.\nGame Days: ${gameDays}\nIs Today A Game Day: ${isGameDay}\nHas Sent Embed: ${hasSentEmbed}`,
    )
    //# iterate game days cache and check if today is a game day
    if (isGameDay === true && hasSentEmbed === false) {
        var embedObj = {
            title: `Game Day!`,
            description: `Checking for completed games today: **${NBA_completedCheckTimes} after 9 PM**`,
            color: '#00ff00',
            target: 'modBotSpamID',
            footer: 'Pluto | Designed by FENIX#7559',
        }
        await sentGameDayEmbed.setKey(todayInfo.todayFullEasy, true)
        await sentGameDayEmbed.save(true)
        await embedReply(null, embedObj)
    } else {
        return
    }
}
