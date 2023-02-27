import fetch from 'node-fetch'
import { Log, SCORE, _ } from '#config'
import { apiReqLog, checkCompletedLog } from '#winstonLogger'

import { checkProgress } from '../db/matchupOps/progress/checkProgress.js'
import { closeLostBets } from '../db/betOps/closeBets/closeLostBets.js'
import { closeWonBets } from '../db/betOps/closeBets/closeWonBets.js'
import dmMe from '../bot_res/dmMe.js'
import { getShortName } from '../bot_res/getShortName.js'
import { idApiExisting } from '../db/validation/idApiExisting.js'
import { queueDeleteChannel } from '../db/gameSchedule/queueDeleteChannel.js'
import { removeMatch } from '#utilMatchups/removeMatchup'
import { setProgress } from '../db/matchupOps/progress/setProgress.js'
import { determineWinner } from '../bot_res/betOps/determineWinner.js'

const url = SCORE
const options = {
    method: 'GET',
    headers: {
        'X-RapidAPI-Host': 'api.the-odds-api.com',
        // eslint-disable-next-line no-undef
        'X-RapidAPI-Key': process.env.odds_API_XKEY,
    },
}
/**
 * @module checkCompleted
 * Calls the odds-api and accesses current score information.
 * Finished games have the `completed` property set to true.
 * When evaluating a matchup, we:
 * 1. Fetch the matchup information from the database to retrieve the ID matching both teams
 * 2. Evaluate the matchup and compare scores in the API to determine the winner
 * 3. Once the winner is determined, the information is sent to {@link closeWonBets} & {@link @closeLostBets} to close the bets for the matchup
 */

export async function checkCompleted() {
    const fileName = `[checkCompleted.js]`
    await checkCompletedLog.info(`Init Check Completed`, {
        status: `Initilization check for completed games`,
    })
    let response
    let apiJSON
    try {
        response = await fetch(url, options)
        apiJSON = await response.json()
    } catch (error) {
        await checkCompletedLog.error(`API Call Error`, { errorMsg: error })
        return
    }
    const compResults = apiJSON
    await apiReqLog.info(`API Connection Info`, {
        status: `Connection successful`,
    })
    const skippedGames = []
    for await (const [key, value] of Object.entries(compResults)) {
        var idApi = value.id
        // # check for API ID in the DB
        if (value.completed === true && !_.isEmpty(await idApiExisting(idApi))) {
            await checkCompletedLog.info(`Phase: 1`, {
                status: `Collected a Completed Game`,
                hometeam: value.home_team,
                awayteam: value.away_team,
                apiId: idApi,
            })
            await Log.Green(
                `Step 1: - Completed Game Found || ${value.home_team} vs ${value.away_team}`,
            )
            // # Check if we are in the middle of processing bets
            const checkProg = await checkProgress(value.home_team, value.away_team)
            await Log.Blue(`Step 1.5: - Check Progress: ${checkProg}`)
            if (checkProg == 'empty') {
                await checkCompletedLog.info(`Unable to locate Matchup`, {
                    Phase: 1.5,
                    sourceFun: `checkProgress`,
                    hometeam: value.home_team,
                    awayteam: value.away_team,
                    apiId: idApi,
                    error: `Unable to find matchup in database: ${value.home_team} vs ${value.away_team}`,
                })
                await Log.Red(
                    `Unable to find matchup in database: ${value.home_team} vs ${value.away_team}`,
                )
                continue
            } else if (checkProg === false) {
                console.log(`checkProg: ${checkProg}`)
                var gameChan
                // # Queue game channel to be closed in 30 minutes
                const hTeamShort = await getShortName(value.home_team)
                const aTeamShort = await getShortName(value.away_team)
                gameChan = `${aTeamShort}-vs-${hTeamShort}`
                try {
                    await queueDeleteChannel(gameChan)
                    await Log.Green(
                        `Step 3: - Game Channel Queued for Deletion || ${gameChan}`,
                    )
                } catch (err) {
                    await dmMe(
                        `Error during locate / delete game channel for ${value.away_team}-vs.-${value.home_team}\nError: : ${err}`,
                    )
                    await checkCompletedLog.error(`Error`, {
                        Phase: 3,
                        sourceFun: `queueDeleteChannel`,
                        hometeam: value.home_team,
                        awayteam: value.away_team,
                        apiId: idApi,
                        erroMsg: `Error occured during locate / delete game channel for ${value.home_team} vs. ${value.away_team}`,
                    })
                }
                const detWin = await determineWinner(value)
                const { winner, homeOrAwayWon, losingTeam, losingTeamHomeOrAway } =
                    detWin
                await checkCompletedLog.info({
                    status: `Calculating Winner`,
                    hometeam: value.home_team,
                    awayteam: value.away_team,
                    apiId: idApi,
                    statusMsg: `Winner: Home Team: ${winner}`,
                })
                await Log.Green(`Step 4: Winner Determined || ${winner}`)
                // & Declare the matchup as being processed to prevent overlapping the process of closing bets
                await setProgress(value.home_team, value.away_team)
                await Log.Green(
                    `Step 5: Progress Set to true || ${value.home_team} vs ${value.away_team}`,
                )
                // # Close the bets for the winners of the matchup
                await closeWonBets(winner, homeOrAwayWon, losingTeam).catch((err) => {
                    checkCompletedLog.error(`${fileName}`, {
                        error: `Error closing won bets for ${winner} || ${err}`,
                    })
                })
                // # Close the bets for the losers of the matchup
                await closeLostBets(losingTeam, losingTeamHomeOrAway, winner).catch(
                    (err) => {
                        checkCompletedLog.error(`Error`, {
                            errorMsg: `Error closing lost bets for ${losingTeam} || ${err}`,
                            hometeam: value.home_team,
                            awayteam: value.away_team,
                            apiId: idApi,
                        })
                    },
                )
                await dmMe(`Closed Bets for ${value.home_team} vs ${value.away_team}`)
                await removeMatch(value.home_team, value.away_team)
            } else {
                await checkCompletedLog.info({
                    hometeam: value.home_team,
                    awayteam: value.away_team,
                    apiId: idApi,
                    status: `Matchup already being processed`,
                    skipped: true,
                })
                await Log.Yellow(
                    `Bets for Matchup: ${value.home_team} vs. ${value.away_team} are already being closed. This game will not be queued to be processed.`,
                )
                continue
            }
        } else {
            await skippedGames.push(`${value.home_team} vs. ${value.away_team}`)
            continue
        }
    }
    await checkCompletedLog.info(`Games Skipped`, {
        status: `Skipped games:\n${skippedGames.join(`\n`)}\n`,
    })
    await Log.Green(`{
        "stack": 'checkCompleted',
        "status": 'Completed',
    }`)
}
