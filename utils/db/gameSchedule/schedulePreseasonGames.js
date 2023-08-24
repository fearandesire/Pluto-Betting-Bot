/* eslint-disable camelcase */
import _ from 'lodash'
import {
    isToday,
    parseISO,
    isWithinInterval,
    addHours,
    isPast,
} from 'date-fns'
import { db } from '#db'
import {
    COLUMN_MATCHUPS_DATE,
    COLUMN_MATCHUPS_HOME_TEAM,
    COLUMN_MATCHUPS_AWAY_TEAM,
    PRESZN_MATCHUPS_TABLE,
    spinner,
} from '#config'
import { FilterGames } from '../../bot_res/filterUtils.js'
import { getShortName } from '../../bot_res/getShortName.js'
import { scheduleChannels } from './scheduleChannels.js'
import IsoManager from '../../time/IsoManager.js'
import locateChannel from '../../bot_res/locateChan.js'

/**
 * @module schedulePreseasonGames
 * Generate Cron Jobs for Game Channel creation for Preseason Games
 */
export default async function schedulePreseasonGames() {
    const scheduledTally = [0]
    const games = await db.manyOrNone(
        `SELECT * FROM "${PRESZN_MATCHUPS_TABLE}"`,
    )
    const filterGames = _.filter(games, (game) => {
        const gameDate = parseISO(game.date)
        return isToday(gameDate) && !game.completed
    })

    _.forEach(filterGames, async (game) => {
        const isoManager = new IsoManager(game.date)
        let cronTime = null
        const parsedGameDate = parseISO(game.date)
        const now = new Date()
        const oneHourFromNow = addHours(now, 1)

        // Don't schedule channels already open
        const homeTeam = await getShortName(game.home_team)
        const awayTeam = await getShortName(game.away_team)
        const chanTitle = `${awayTeam}-vs-${homeTeam}`
        const chanExist = await locateChannel(chanTitle)
        if (chanExist) {
            return
        }

        if (
            isWithinInterval(parsedGameDate, {
                start: now,
                end: oneHourFromNow,
            }) ||
            isPast(parsedGameDate)
        ) {
            // Game is scheduled within 1 hour
            // Create Cron set to exactly 1 minute from the current time
            cronTime = isoManager.cronRightNow
            await scheduleChannels(
                game.home_team,
                game.away_team,
                {
                    cronStartTime: cronTime,
                },
            )
            scheduledTally[0] += 1
        } else {
            // Game is scheduled beyond 1 hour
            cronTime = isoManager.cron
            await scheduleChannels(
                game.home_team,
                game.away_team,
                {
                    cronStartTime: cronTime,
                    notSubtracted: true,
                },
            )
            scheduledTally[0] += 1
        }
    })
    spinner.success({
        text: `# of Scheduled Games: ${scheduledTally[0]}`,
        color: `green`,
        mark: `✅`,
    })
    return true
}
