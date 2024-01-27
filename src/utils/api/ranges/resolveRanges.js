import cronstrue from 'cronstrue'
import _ from 'lodash'
import { getDay } from 'date-fns'
/**
 * @module resolveRanges
 * Resolve the cron ranges for the completed games into a legible format.
 * @param {array} ranges - An array of cron ranges.
 * @returns {string} - A string representing the cron ranges in a legible format.
 * @example
 * return: 'Friday | 3:00pm-6:00pm \n Saturday | 7:00pm-10:00pm'
 */

export default async function resolveRanges(
	ranges,
	options,
) {
	const days = []
	const times = []
	const rangeDetails = ranges.map((range) => {
		const cronDetails = cronstrue.toString(range) // Example resp: Every 5 minutes, between 03:00 PM and 06:59 PM, on day 16 of the month, only in April
		// # Use Lodash and Regexp to extract any times from `cronDetails`; Ensure we capture AM or PM as well
		const timesRegex = /(\d{1,2}:\d{2} (AM|PM))/g
		const rangeTime = cronDetails
			.match(timesRegex)
			// times come in as `03:00 PM` for example, remove the first 0 in each time
			.map((time) => time.replace(/^0/, ''))
			.join(' - ')
		// # month will be the last word in cronDetails
		const month = _.last(_.split(cronDetails, ' '))
		// extract dayOfWeek from cronDetails by getting the first number after 'day'
		const dayOfWeek = _.split(
			cronDetails,
			'day',
		)[1].split(' ')[1]
		const date = new Date(`${month} ${dayOfWeek}, 2023`)
		const dayOfWeekNum = getDay(date)
		const dayNames = [
			'Sunday',
			'Monday',
			'Tuesday',
			'Wednesday',
			'Thursday',
			'Friday',
			'Saturday',
		]
		const rangeDay = dayNames[dayOfWeekNum]
		days.push(rangeDay)
		times.push(rangeTime)
		const rangeStr = `${rangeDay} | ${rangeTime}`
		return rangeStr
	})
	if (options?.api === true) {
		const apiArr = []
		// # Return an array of objects with the days and times parsed
		for (let i = 0; i < days.length; i++) {
			apiArr.push({
				day: days[i],
				time: times[i],
			})
		}
		return apiArr
	}
	return rangeDetails.join('\n')
}
