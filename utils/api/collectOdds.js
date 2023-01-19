import { ODDS, container, embedReply, gamesScheduled } from '#config'
import {
    format,
    formatISO,
    getDay,
    getHours,
    getMinutes,
    parseISO,
} from 'date-fns'

import _ from 'lodash'
import { assignMatchID } from '#botUtil/AssignIDs'
import { collectOddsLog } from '../logging.js'
import { createMatchups } from '#utilMatchups/createMatchups'
import { dmMe } from '../bot_res/dmMe.js'
import fetch from 'node-fetch'
import flatcache from 'flat-cache'
import { gameDaysCache } from '../cache/gameDaysCache.js'
import { isMatchExist } from '#utilValidate/isMatchExist'
import { resolveDayName } from '../bot_res/resolveDayName.js'
import { resolveIso } from '#dateUtil/resolveIso'
import { resolveToday } from '#dateUtil/resolveToday'
import { scheduleChannels } from '../db/gameSchedule/scheduleChannels.js'
import { scheduleEmbed } from '../db/gameSchedule/scheduleEmbed.js'

let oddsCache = flatcache.create(`oddsCache.json`, './cache/weeklyOdds')

/**
 * @module collectOdds
 * Call the API and store the matchup odds for the week into the database & cache
 */

export async function collectOdds(message) {
    if (!message) {
        message == null
    }
    const url = ODDS
    const options = {
        method: 'GET',
        headers: {
            'X-RapidAPI-Host': 'api.the-odds-api.com',
            // eslint-disable-next-line no-undef
            'X-RapidAPI-Key': process.env.odds_API_XKEY,
        },
    }
    let matchups = {} //# to store matchups into cache
    container.allOddsObj = {}
    let apiRequest
    // let apiRes
    let allOddsObj
    collectOddsLog.notice({
        status: `New Session`,
    })
    try {
        apiRequest = await fetch(url, options).then((res) => res.json())
        allOddsObj = apiRequest
    } catch (error) {
        collectOddsLog.error({ errorMsg: error })
        return
    }
    container.matchupCount = 0
    // ? Clear txt arr of game schedule
    await flatcache.clearCacheById(`scheduleArr.json`)
    for (let [key, value] of Object.entries(allOddsObj)) {
        let isoDate = value.commence_time
        //# Storing games that are scheduled for this week || API can return games for the next week, but they have no odds.
        let todayDateInfo = new resolveToday()
        let weekNum = todayDateInfo.weekNum
        let apiDateInfo = new resolveIso(isoDate)
        let apiWeekNum = apiDateInfo.weekNum
        var gameDay = apiDateInfo.dayNum
        var monthNum = apiDateInfo.month
        var gameYear = apiDateInfo.year
        var apiDoW = apiDateInfo.dayOfWeek
        var nextWeek = parseInt(weekNum) + 1 //# Fetch Monday Games
        var gameDate = `${monthNum}/${gameDay}/${gameYear}`
        if (await isMatchExist(value.home_team)) {
            //# there is a unique-key constraint in the database, but this is to prevent the count of games scheduled from being incorrect
            collectOddsLog.error({
                status: `Duplicate Matchup`,
                teamone: value.home_team,
                teamtwo: value.away_team,
            })
            continue
        }
        if (
            apiWeekNum === weekNum ||
            (apiWeekNum === nextWeek && apiDoW === 'Mon')
        ) {
            container.matchupCount++
            //# game start day & time
            let apiStartDay = apiDateInfo.dayNum
            let apiStartHour = apiDateInfo.hour
            let apiStartMin = apiDateInfo.minute
            let gameStartTime = `${apiStartDay}${apiStartHour}${apiStartMin}`
            let fullStartTime = `Start Info\nDay: ${apiStartDay} Hour: ${apiStartHour} Minute: ${apiStartMin}`
            let home_odds
            let away_odds
            var home_team = value.home_team
            var away_team = value.away_team
            var selectedOdds = value?.bookmakers[0]?.markets[0].outcomes
                ? value.bookmakers[0]?.markets[0].outcomes
                : null
            if (selectedOdds) {
                var findHomeOdds = _.find(selectedOdds, { name: `${home_team}` })
                var findAwayOdds = _.find(selectedOdds, { name: `${away_team}` })
                home_odds = findHomeOdds.price
                away_odds = findAwayOdds.price
            } else {
                continue
            }
            // # Skip games w. no odds
            if (!home_odds || !away_odds) {
                continue
            }
            //# identifier for the game via the API
            var idApi = value.id
            //# date-fns to parse the ISO, get the start time & format it for Cron Jobs
            var gameTime = parseISO(isoDate)
            var formattedISO = formatISO(gameTime, { representation: 'complete' })
            var startHour = getHours(gameTime)
            var startMin = getMinutes(gameTime)
            var startDay = getDay(gameTime)
            var startDayOfMonth = Number(format(gameTime, `d`))
            var startMonth = Number(format(gameTime, `M`))
            var cronStartTime = `${startMin} ${startHour} ${startDayOfMonth} ${startMonth} ${startDay}`
            let matchupId = await assignMatchID()
            var dayName = await resolveDayName(startDay)
            if (startMin.toString().length === 1) {
                startMin = `${startMin}0`
            }
            var amOrPm
            if (startHour > 12) {
                amOrPm = 'PM'
                startHour = startHour - 12
            }
            var legibleStartTime = `${dayName}, ${startHour}:${startMin} ${amOrPm}`
            matchups[`${matchupId}`] = {
                [`home_team`]: home_team,
                [`away_team`]: away_team,
                [`home_teamOdds`]: home_odds,
                [`away_teamOdds`]: away_odds,
                [`matchupId`]: matchupId,
                [`startTime`]: gameStartTime,
                [`fullStartTime`]: fullStartTime,
                [`dateView`]: gameDate, //* date formatted as month/day/year
                [`dayNum`]: apiStartDay,
                [`dayOfWeek`]: gameDay,
                [`hour`]: apiStartHour,
                [`minute`]: apiStartMin,
                [`gameDayName`]: apiDoW,
                [`cronStartTime`]: cronStartTime,
                [`legibleStartTime`]: legibleStartTime,
            }
            await collectOddsLog.notice({
                status: `Storing Match`,
                matchInfo: matchups[`${matchupId}`],
            })
            //# matchups to DB
            await createMatchups(
                message,
                home_team,
                away_team,
                home_odds,
                away_odds,
                matchupId,
                gameDate,
                formattedISO,
                cronStartTime,
                legibleStartTime,
                idApi,
            )
            //# queue game channel creation
            await scheduleChannels(
                home_team,
                away_team,
                cronStartTime,
                legibleStartTime,
            )
            //# save day of the week names to cache for daily embeds to staff
            await gameDaysCache(dayName)
        } else {
            collectOddsLog.warning({
                status: `Skipped Storing Match`,
                teamone: value.home_team,
                teamtwo: value.away_team,
            })
            continue
        }
    }
    if (_.isEmpty(matchups)) {
        await dmMe(
            `Issue occured while collecting & storing matchups. No Information has been stored.`,
        )
        collectOddsLog.error(
            `Issue occured while collecting & storing matchup. No Information has been stored.`,
        )
        return
    }
    await oddsCache.setKey(`matchups`, matchups)
    await oddsCache.save(true)
    await collectOddsLog.notice({
        status: `Complete`,
        count: container.matchupCount,
    })
    if (message !== null) {
        var embObj = await scheduleEmbed()
        await embedReply(message, embObj)
    }
    if (message == null) {
        setTimeout(async () => {
            await dmMe(`Matchups stored: **${container.matchupCount}**`)
        }, 10000)
        return
    }
}
