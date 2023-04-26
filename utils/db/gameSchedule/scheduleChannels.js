import flatcache from 'flat-cache'
import { createRequire } from 'module'
import _ from 'lodash'
import { Log } from '#config'
import { scheduleChanLog } from '#winstonLogger'
import { createChannel } from './createChannel.js'
import { getShortName } from '../../bot_res/getShortName.js'
import { cronMath } from './cronMath.js'

const require = createRequire(import.meta.url)
const cron = require('node-cron')

/**
 * @module scheduleChannels
 * Use the Cron Time created from {@link collectOdds} to schedule the game channel creation for each game.
 * If the bot is reset, Pluto will collect the corn jobs from the database and schedule them again.
 */

export async function scheduleChannels(
	homeTeam,
	awayTeam,
	cronStartTime,
	legibleStartTime,
	noMath,
) {
	let newCron
	if (!noMath) {
		newCron = await new cronMath(cronStartTime).subtract(1, `hours`)
	} else {
		newCron = cronStartTime
	}
	homeTeam = await getShortName(homeTeam)
	awayTeam = await getShortName(awayTeam)
	await Log.Yellow(
		`Creating a Cron Job to create a game channel for: ${awayTeam} vs ${homeTeam} | Cron Time: ${newCron}`,
	)
	await scheduleChanLog.info(
		`Creating a Cron Job to create a game channel for: ${awayTeam} vs ${homeTeam} | Cron Time: ${newCron}`,
	)
	const createCron = async () => {
		await cron.schedule(
			`${newCron}`,
			async () => {
				await createChannel(awayTeam, homeTeam)
			},
			{ timezone: 'America/New_York' },
		)
	}
	await createCron().then(async () => {
		await Log.Green(
			`Successfully created Cron Job to create a game channel for: ${awayTeam} vs ${homeTeam} | Cron Time: ${newCron}`,
		)
		await scheduleChanLog.info(
			`Successfully created Cron Job to create a game channel for: ${awayTeam} vs ${homeTeam} | Cron Time: ${newCron}`,
		)
	})
}
