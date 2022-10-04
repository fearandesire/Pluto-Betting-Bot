import { resolveIso } from './../date/resolveIso.js'
import { resolveToday } from '../date/resolveToday.js'

/**
 * Verify & Compare the week numbers of the game & current date.
 * @param {string} isoDate - The API game date (ISO format)
 * @return {boolean} - Returns true if the date's being gathered match today's date
 */

export async function verifyDate(isoDate) {
    let weekNum = new resolveToday().weekNum
    let apiWeekNum = new resolveIso(isoDate).weekNum
    console.log(
        `[verifyDate.js] Todays Week Number: ${weekNum} --> API Week Number: ${apiWeekNum}`,
    )
    if (weekNum === apiWeekNum) {
        console.log(`[verifyDate.js] Week Matches`)
        return true
    } else {
        console.log(`[verifyDate.js] Week does not match`)
        return false
    }
}
