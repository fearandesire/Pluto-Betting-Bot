import { parseISO } from 'date-fns'

/**
 * @module cronRangeGenerator
 * @summary Generate a set of Cron Ranges based on the provided array of matchups.
 * @param {array} matchesArr - An array of objects containing the matchups for today
 *
 * @description This function assists the application in checking for completed games within a specific time frame to
 * minimize the number of API calls called daily.
 * The cron ranges are created by parsing the `startTime` from each game object in the provided array of matchups.
 * The times from `the-odds-api` are by default in ISO 8601 format. This function will determine the earliest and the latest games (start and end of the arr) and then reference today\'s date to ensure that the cron ranges generated are between the earliest and latest games.
 * Games that start at 8 PM (20:00) or later will have the 2nd cron range to go into the following day, early-AM hours.
 *
 * Example of @param matchesArr
 * @example
 * [
	{
		startTime: '2022-01-01T00:00:00.000Z',
	},
	{
		startTime: '2022-01-01T03:00:00.000Z',
	},
]
 * 
 */

export default function cronRangeGenerator(matchesArr) {
	const earliestGame = matchesArr[0]
	const latestGame = matchesArr[matchesArr.length - 1]
	const earliestGameStart = parseISO(
		earliestGame.startTime,
	)
	const latestGameStart = parseISO(latestGame.startTime)
	const earliestDayNum = earliestGameStart.getDate()
	let latestDayNum = latestGameStart.getDate()
	const minInterval = '*/5'
	const earliestHour = earliestGameStart.getHours()
	const latestHour = latestGameStart.getHours()
	let latestHourString
	const earliestHourString = `${earliestHour}-${
		earliestHour + 3
	}`
	// # Increment the day, hour string should be 0-3
	if (latestHour >= 20) {
		const nextDay = new Date(latestGameStart)
		latestDayNum = nextDay.getDate() + 1
		latestHourString = `0-3`
	} else {
		latestHourString = `${latestHour}-${latestHour + 3}`
	}
	const monthNum = `${new Date().getMonth() + 1}`
	const range1 = `${minInterval} ${earliestHourString} ${earliestDayNum} ${monthNum} *`
	const range2 = `${minInterval} ${latestHourString} ${latestDayNum} ${monthNum} *`
	return { range1, range2 }
}
