import { getHours, getMinutes, getDate, getMonth, formatISO } from 'date-fns'
import _ from 'lodash'
import fetch from 'node-fetch'
import flatcache from 'flat-cache'
import Promise from 'bluebird'
import { v4 as uuidv4 } from 'uuid'
import { ODDS, container, embedReply, gamesScheduled, Log } from '#config'
import { assignMatchID } from '#botUtil/AssignIDs'
import { cacheAdmn, inCache } from '#cacheMngr'
import { collectOddsLog } from '../logging.js'
import { storeMatchups } from '#utilMatchups/storeMatchups'
import { gameDaysCache } from '../cache/gameDaysCache.js'
import { isMatchExist } from '#utilValidate/isMatchExist'
import { scheduleChannels } from '../db/gameSchedule/scheduleChannels.js'
import { scheduleEmbed } from '../db/gameSchedule/scheduleEmbed.js'
import {
    isoManager,
    MDY as todayDate,
    toMDY,
    isoToCron,
    isoToDayOfWeek,
} from './apiUtils.js'
import generateCronJobs from './generateCronJobs.js'

const oddsCache = flatcache.create(`oddsCache.json`, './cache/weeklyOdds')

/**
 * @module collectOdds
 * Call the API and store the matchup odds for the week into the database & cache
 */

export async function collectOdds() {
    const apiUrl = ODDS

    // Set API headers
    const headers = {
        'X-RapidAPI-Host': 'api.the-odds-api.com',
        'X-RapidAPI-Key': process.env.odds_API_XKEY,
    }

    // Fetch data from the API
    const apiData = await fetch(apiUrl, { method: 'GET', headers }).then((res) =>
        res.json(),
    )

    // ? Filter data by games that are scheduled today
    const todayGames = apiData.filter((game) =>
        isoManager(game.commence_time, { today: true }),
    )

    const matchups = {} // obj to store details of each match into cache
    // ? Identify & store details for each game via the data collected
    await Promise.map(todayGames, async (game) => {
        const homeTeam = game.home_team
        const awayTeam = game.away_team
        const homeOdds = _.find(game.bookmakers[0]?.markets[0].outcomes, {
            name: homeTeam,
        })?.price
        const awayOdds = _.find(game.bookmakers[0]?.markets[0].outcomes, {
            name: awayTeam,
        })?.price

        // Skip games without odds information
        if (!homeOdds || !awayOdds) {
            return
        }

        // Generate unique ID for the game
        const gameId = await assignMatchID()

        // Store the odds information and other data for the game
        _.assign(matchups, {
            [gameId]: {
                home_team: homeTeam,
                away_team: awayTeam,
                home_teamOdds: homeOdds,
                away_teamOdds: awayOdds,
                matchupId: gameId,
                start_time: game.commence_time,
            },
        })

        // Date & Time info to store into the database
        const gameDate = await isoManager(game.commence_time, { formatDate: true })
        const cronStartTime = await isoToCron(game.commence_time)

        const legibleStart = await isoManager(game.commence_time, {
            formatTime: true,
        })
        const uniqueDbId = await uuidv4()
        const colmdata = {
            teamOne: homeTeam,
            teamTwo: awayTeam,
            teamOneOdds: homeOdds,
            teamTwoOdds: awayOdds,
            matchupId: gameId,
            gameDate,
            startTimeISO: game.commence_time,
            cronStartTime,
            legibleStartTime: legibleStart,
            idApi: uniqueDbId,
        }
        await storeMatchups(colmdata) // # Store in database
        await scheduleChannels(homeTeam, awayTeam, cronStartTime, legibleStart)
        const dayName = isoToDayOfWeek(game.commence_time)
        await gameDaysCache(dayName)
    })

    // Store the matchups information into the cache
    await oddsCache.setKey('matchups', matchups)
    await oddsCache.save(true)
    if (await !inCache(`matchups`)) {
        await cacheAdmn.set('matchups', matchups)
        await Log.Green(`[collectOdds] New matchup collection stored into cache`)
    }
    await scheduleEmbed()
    await generateCronJobs()
}
