import { createRequire } from 'module'
import { completedReqLog } from './../logging.js'
import { checkCompleted } from './checkCompleted.js'

const require = createRequire(import.meta.url)
const cron = require('cronitor')(`f9f7339479104e79bf2b52eb9c2242bf`)
cron.wraps(require('node-cron'))
const monitor = new cron.Monitor('completedReq Monitor')
/**
 * @module completedReq -
 * Setup a sequence of  API Calls to check for completed games every 15 minutes starting from the earliest NFL Game Times.
 * According to the NFL Schedule. Mondays, Thursdays & Sundays are game days
 * Schedule Times stay consistent:
 * - Monday: 8:00  PM
 * - Sunday; 1:00 PM
 * - Thursday 8:00 PM
 */

export async function completedReq() {
	completedReqLog.info(`Running completedReq.js - Initializing Cron Jobs`)
	let thursTimer = `*/15 20 * * thu`
	cron.schedule(
		`thursdayCheckGames`,
		`${thursTimer}`,
		async () => {
			completedReqLog.info(`Checking for completed games..`)
			monitor.ping({ state: 'run' })
			await checkCompleted()
		},
		{ timezone: 'America/New_York' },
	)
	let sundayTimer = `*/15 14 * * sun`
	cron.schedule(
		`sundayCheckGames`,
		`${sundayTimer}`,
		async () => {
			completedReqLog.info(`Checking for completed games..`)
			monitor.ping({ state: 'run' })
			await checkCompleted()
		},
		{ timezone: 'America/New_York' },
	)
}
