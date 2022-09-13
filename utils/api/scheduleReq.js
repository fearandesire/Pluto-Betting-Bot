import { flatcache } from '#config'
import currentWeekNumber from 'current-week-number'
import { createRequire } from 'module'
import { scheduleReqLog } from '../logging.js'
import { collectOdds } from './collectOdds.js'

const require = createRequire(import.meta.url)

const cron = require('cronitor')(`f9f7339479104e79bf2b52eb9c2242bf`)
cron.wraps(require('node-cron'))

/** 
@module scheduleReq 
Per NFL Schedule - Setup API calls to gather the odds for upcoming NFL Games
We will call for the odds per week; Currently set to Tuesday Mornings @ 2:00 AM EST
*/

export async function scheduleReq() {
	let schReqCache = await flatcache.create(
		`lastWeekCalled.json`,
		'./cache/scheduleReq',
	)
	let lastWeekCalled = schReqCache.getKey('lastWeekCalled')
		? schReqCache.getKey('weekCalledLast')
		: schReqCache.setKey(`weekCalledLast`, 'empty')

	cron.schedule(
		`collectMatchupsReq`,
		`0 2 * * tue`,
		async () => {
			scheduleReqLog.info(`Verifying if we have reached a new week...`)
			var currentWeek = currentWeekNumber()
			if (lastWeekCalled !== currentWeek) {
				scheduleReqLog.info(
					`Detected a new week! Currently calling this week's odds from the API`,
				)
				await collectOdds()
				lastWeekCalled = currentWeek
				schReqCache.setKey(`weekCalledLast`, currentWeek)
				schReqCache.save(true)
				return
			}
		},
		{ timezone: 'America/New_York' },
	)
}
