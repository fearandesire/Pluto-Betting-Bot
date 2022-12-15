import { Log, SCORE, _, LIVEBETS, BETSLIPS, CURRENCY } from '#config'

import fetch from 'node-fetch'
import { determineWinner } from '../../bot_res/betOps/determineWinner.js'
import { db } from '#db'
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
 * @module closeOutstanding
 * Close any outstanding bets that are still remaining in the database.
 * @description This function will iterate through the API and:
 * 1. Check for completed games
 * 2. Determine the winner ({@link determineWinner})
 * 3. Add name of the winner and loser to global array
 * 4. 'Close' any bets that were for the winning team
 * 5. 'Close' any bets that were for the losing team
 */
export async function closeOutstanding(interaction) {
    Log.Green(`Closing outstanding bets for: 12/13/2022`)
    let response
    let apiJSON
    let winner
    let losingTeam
    let winTeams = []
    let loseTeams = []
    try {
        response = await fetch(url, options)
        apiJSON = await response.json()
    } catch (error) {
        Log.Red(`Failed to fetch score from API\n${error}`)
        return
    }
    for await (let [key, value] of Object.entries(apiJSON)) {
        console.log(value.commence_time)
        if (value.completed === true && value.commence_time.match(/12-13/)) {
            let detWin = await determineWinner(value)
            if (detWin) {
                winner = detWin.winner
                losingTeam = detWin.losingTeam
                winTeams.push(winner)
                loseTeams.push(losingTeam)
            }
        }
    }
    console.log(`Winners: ${winTeams}\nLosers: ${loseTeams}`)
    let winBets = await db.manyOrNone(
        `SELECT * FROM "${BETSLIPS}" WHERE teamid = ANY($1) AND dateofbet = '12/13/2022'`,
        [winTeams],
    )
    console.log(
        `All (#${winBets.length}) bets for winning teams: ${winBets}`,
        winBets,
    )
    let loseBets = await db.manyOrNone(
        `SELECT * FROM "${BETSLIPS}" WHERE teamid = ANY($1) AND dateofbet = '12/13/2022'`,
        [loseTeams],
    )
    // # Close bets for winning teams
    for await (let bet of winBets) {
        // # Select the 'payout' from their bet and add it to their 'balance' in the 'CURRENCY' table
        let payout = await db.one(
            `SELECT payout FROM "${BETSLIPS}" WHERE betid = $1`,
            [bet.betid],
        )
        let balance = await db.one(
            `SELECT balance FROM "${CURRENCY}" WHERE userid = $1`,
            [bet.userid],
        )
        let newBalance = Number(balance.balance) + Number(payout.payout)
        // # Update balance
        await db.none(`UPDATE "${CURRENCY}" SET balance = $1 WHERE userid = $2`, [
            newBalance,
            bet.userid,
        ])
        // # Update bet status
        await db.none(
            `UPDATE "${BETSLIPS}" SET betresult = 'won' WHERE betid = $1`,
            [bet.betid],
        )
        // # Delete bet from 'livebets' table
        await db.none(`DELETE FROM "${LIVEBETS}" WHERE betid = $1`, [bet.betid])
        await Log.Green(`{
            betid: ${bet.betid},
            userid: ${bet.userid},
            status: won
        }`)
    }
    // # Close bets for losing teams
    for await (let bet of loseBets) {
        // # Update bet status
        await db.none(
            `UPDATE "${BETSLIPS}" SET betresult = 'lost' WHERE betid = $1`,
            [bet.betid],
        )
        // # Delete bet from 'livebets' table
        await db.none(`DELETE FROM "${LIVEBETS}" WHERE betid = $1`, [bet.betid])
        await Log.Green(`{
            betid: ${bet.betid},
            userid: ${bet.userid},
            status: lost
        }`)
    }
}
