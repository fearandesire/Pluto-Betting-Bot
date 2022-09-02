/**
 * Verify the date of the odds being gathered match today's date. Converts ISO time to local and compares the two dates.
 * @param {string} isoDate - The API game date (ISO format)
 * @return {boolean} - Returns true if the date's being gathered match today's date
 */

export function verifyDate(isoDate) {
    //let todaysDay = new Date().getDate()
    let todaysDay = 11
    let todaysMonth = 9
    //let todaysMonth = new Date().getMonth()
    var dayFromIso = new Date(isoDate.slice(0, -1)).getDate()
    var monthFromIso = new Date(isoDate.slice(0, -1)).getMonth()
    monthFromIso = parseInt(monthFromIso) + 1 //# for some reason, the month is off by 1
    var convertedIso = `${monthFromIso}-${dayFromIso}`
    var todayFull = `${todaysMonth}-${todaysDay}`
    if (convertedIso === todayFull) {
        return true
    }
}
