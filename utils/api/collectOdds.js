import _ from 'lodash'
import { assignMatchID } from '../bot_res/AssignIDs.js'
import { collectOddsLog } from './../logging.js'
import { container } from '#config'
import { createMatchups } from '../cmd_res/createMatchups.js'
import fetch from 'node-fetch'
import flatcache from 'flat-cache'
import { msgBotChan } from '../bot_res/send_functions/msgBotChan.js'
import { resolveIso } from '../date/resolveIso.js'
import { resolveToday } from '../date/resolveToday.js'

let oddsCache = flatcache.create(`oddsCache.json`, './cache/weeklyOdds')

/**
 * @module collectOdds
 * Call the API and store the matchup odds for the week into the database & cache
 */

export async function collectOdds(message) {
    if (!message) {
        message == null
    }
    const url =
        // eslint-disable-next-line no-undef
        process.env.odds_API_NFLODDS
    const options = {
        method: 'GET',
        headers: {
            'X-RapidAPI-Host': 'api.the-odds-api.com',
            // eslint-disable-next-line no-undef
            'X-RapidAPI-Key': process.env.odds_API_XKEY2,
        },
    }
    let matchups = {} //# to store matchups into cache
    let matchupCount = 0
    container.allNflOdds = {}
    //* for caching and sending the cache

    await fetch(url, options)
        .then((res) => res.json())
        .then((json) => {
            collectOddsLog.info(`Initializing collection of odds for the week`)
            //? Returns the list of matchups
            var apiGamesList = json
            container.allNflOdds = apiGamesList
        })
    var allNflOdds = container.allNflOdds
    container.matchupCount = 0
    await _.forEach(allNflOdds, async function (value, key) {
        //* only store games that are scheduled for this week
        let isoDate = value.commence_time
        let todayDateInfo = new resolveToday()
        let weekNum = todayDateInfo.weekNum
        let apiDateInfo = new resolveIso(isoDate)
        let apiWeekNum = apiDateInfo.weekNum
        var gameDay = apiDateInfo.dayNum
        var monthNum = apiDateInfo.month
        var gameYear = apiDateInfo.year
        var apiDoW = apiDateInfo.dayOfWeek
        var nextWeek = parseInt(weekNum) + 1
        var gameDate = `${monthNum}/${gameDay}/${gameYear}`
        console.log(
            `Today's Week: ${weekNum} | API Week: ${apiWeekNum} | Game Day: ${apiDoW}`,
        )
        if (
            weekNum === apiWeekNum ||
            (nextWeek === apiWeekNum && apiDoW === 'Mon')
        ) {
            container.matchupCount++
            //# the current day and time
            let currentDay = todayDateInfo.dayNum
            let currentHour = todayDateInfo.hour
            let currentMinute = todayDateInfo.minute
            //# game start day & time
            let apiStartDay = apiDateInfo.dayNum
            let apiStartHour = apiDateInfo.hour
            let apiStartMin = apiDateInfo.minute
            let gameStartTime = `${apiStartDay}${apiStartHour}${apiStartMin}`
            let fullStartTime = `DAY: ${apiStartDay} HOUR: ${apiStartHour} MINUTE: ${apiStartMin}`
            matchups[key] = value
            let home_odds
            let away_odds
            var home_team = value.home_team
            var away_team = value.away_team
            var selectedOdds = value?.bookmakers[0]?.markets[0].outcomes
                ? value.bookmakers[0]?.markets[0].outcomes
                : null
            if (selectedOdds) {
                home_odds = selectedOdds[0].price
                away_odds = selectedOdds[1].price
            } else {
                home_odds = 'n/a'
                away_odds = 'n/a'
            }
            let matchupId = await assignMatchID()
            matchups[key] = {
                [`home_team`]: home_team,
                [`away_team`]: away_team,
                [`home_teamOdds`]: home_odds,
                [`away_teamOdds`]: away_odds,
                [`matchupId`]: matchupId,
                [`startTime`]: gameStartTime,
                [`fulStartTime`]: fullStartTime,
                [`dateView`]: gameDate, //* date formatted as month/day/year
                [`dayNum`]: apiStartDay,
                [`dayOfWeek`]: gameDay,
                [`hour`]: apiStartHour,
                [`minute`]: apiStartMin,
                [`gameDayName`]: apiDoW,
            }
            console.log(`Matchup ID: ${matchupId}`)
            await createMatchups(
                message,
                home_team,
                away_team,
                home_odds,
                away_odds,
                matchupId,
                gameDate,
            )
        }
        // end of map
    })
    if (_.isEmpty(matchups)) {
        await msgBotChan(
            `Issue occured while collecting & storing matchups. No Information has been stored.`,
            `error`,
        )
        collectOddsLog.error(
            `Issue occured while collecting & storing matchup. No Information has been stored.`,
        )
        return
    }

    collectOddsLog.info(`All Matchup information collected:`)
    collectOddsLog.info(JSON.stringify(matchups))
    oddsCache.setKey(`matchups`, matchups)
    oddsCache.save(true)
    collectOddsLog.info(
        `Successfully gathered odds for the week.\nOdds are stored into cache & db\n# Of Matchups Stored: (${container.matchupCount})`,
    )
    if (message !== null) {
        setTimeout(() => {
            message.reply(
                `Odds stored into cache & db. (# Of Matches: ${container.matchupCount})`,
            )
        }, 6500)
        return
    }
    if (message == null) {
        setTimeout(() => {
            msgBotChan(
                `Odds stored into cache & db. (# Of Matches: ${container.matchupCount})`,
            )
        }, 6500)
        return
    }
    //container.CollectedOdds = true
}
