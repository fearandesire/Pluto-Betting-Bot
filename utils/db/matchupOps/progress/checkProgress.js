/**
 * @module checkProgress
 * @summary Check if a matchup is in the process of having it's bets closed
 * @returns {boolean} - True if the matchup is in progress, false if not
 */

import { inProgress } from './inProgress.js'

export async function checkProgress(homeTeam, awayTeam) {
    var progCheck = await inProgress(homeTeam, awayTeam).then((res) => {
        var inProg = res[0].inprogress
        console.log(
            `[checkProgress.js] ${homeTeam} vs. ${awayTeam}: In Progress Result: ${inProg}`,
        )
        if (inProg == true) {
            return true
        } else {
            return false
        }
    })
    return progCheck
}
