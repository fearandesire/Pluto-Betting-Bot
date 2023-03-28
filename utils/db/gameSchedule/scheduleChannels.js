import flatcache from 'flat-cache'
import { createRequire } from 'module'
import _ from 'lodash'
import { Log } from '#config'
import { createChannel } from './createChannel.js'
import { getShortName } from '../../bot_res/getShortName.js'
import { scheduleChanLog } from '#winstonLogger'
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
	await console.log(
		`Scheduling channel:\n${homeTeam} vs ${awayTeam} | ${cronStartTime} | ${legibleStartTime}`,
	)
	const schCache = await flatcache.create(
		`scheduleArr.json`,
		`./cache/scheduleArr`,
	)
	let schArr = (await schCache.getKey(`scheduleArr`)) || null
	if (!schArr) {
		await schCache.setKey(`scheduleArr`, [])
		await schCache.save(true)
		schArr = await schCache.getKey(`scheduleArr`)
	}
	let newCron
	if (noMath === false) {
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
		// # Get first num in legibleStartTime string and subtract 1
		let firstNum = legibleStartTime.match(/\d+/)
		firstNum = Number(firstNum[0])
		const adjNum = firstNum - 1
		// # Replace it in the string
		const replaced = legibleStartTime.replace(firstNum, adjNum)
		const schStr = `• ${awayTeam} vs ${homeTeam} | ${replaced}`
		const dupeCheck = _.find(schArr, (o) => o === schStr)
		if (!dupeCheck) {
			await schArr.push(schStr)
		}
		await schCache.save(true)
	})
}
