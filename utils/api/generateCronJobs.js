import cron from 'node-cron'
import { logCron } from './apiUtils.js'
import { handleBetMatchups } from './handleBetMatchups.js'
import { rangeManager } from '#matchMngr'
import cronRangeGenerator from './cronRangeGenerator.js'

/**
 * Generates two cron jobs based on the start times of matches in the given array.
 * @param {Array} matchesArr - An array of match objects, each containing the ISO 8061 start time of the match.
 * @returns {Promise<Array>} A promise that resolves to an array of the two CronJob instances that were created and started.
 */

export default async function generateCronJobs(matchesArr) {
	const todaysMatches = matchesArr
	if (!todaysMatches) {
		return false
	}
	const { range1, range2 } = await cronRangeGenerator(
		matchesArr,
	)
	const title = `generateCronJobs`
	const msg = `Checking for completed matches.`

	try {
		cron.schedule(range1, async () => {
			logCron({
				title,
				msg,
			})
			await handleBetMatchups()
		})

		cron.schedule(range2, async () => {
			logCron({
				title,
				msg,
			})
			await handleBetMatchups()
		})
		await rangeManager({
			post: true,
			r1: range1,
			r2: range2,
		})
		const rangeObj = {
			range1,
			range2,
		}
		return Promise.resolve(rangeObj)
	} catch (error) {
		console.error(
			`Error during generateCronJobs:`,
			error,
		)
		throw Promise.reject(error)
	}
}
