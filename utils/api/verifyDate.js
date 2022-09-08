import currentWeekNumber from 'current-week-number'

/**
 * Verify the date of the odds being gathered match today's date. Converts ISO time to local and compares the two dates.
 * We are comparing the dates via the # of the week in the year, as we will schedule the matchups into DB weekly to preserve API requests
 * @param {string} isoDate - The API game date (ISO format)
 * @return {boolean} - Returns true if the date's being gathered match today's date
 */

export function verifyDate(isoDate) {
	//let todaysDay = new Date().getDate()

	let today = new Date()
	let todaysDay = today.getDay()
	let todaysMonth = today.getMonth() + 1
	let todaysYear = today.getFullYear()

	var apiDate = new Date(isoDate.slice(0, -1))
	var dayFromIso = apiDate.getDate()
	var monthFromIso = apiDate.getMonth() + 1
	var yearFromIso = apiDate.getFullYear()

	var todayFull = `${todaysMonth} ${todaysDay}, ${todaysYear}`
	var apiDateFull = `${monthFromIso} ${dayFromIso}, ${yearFromIso}`
	var weekNum = currentWeekNumber(todayFull)
	weekNum = parseInt(weekNum) + 1 //# NFL counts their schedule onto the following week as it goes Thurs-Sun-Mon
	var apiWeekNum = currentWeekNumber(apiDateFull)

	console.log(`Weeknum: ${weekNum} -- apiWeekNum: ${apiWeekNum}`)
	if (weekNum === apiWeekNum) {
		return true
	}
}
