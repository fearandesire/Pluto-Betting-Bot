import { Log } from '@pluto-internal-logger'
import Cache from '@pluto-redis'
import { createChannel } from './createChannel.js'
import CronMath from './CronMath.js'
import CronJobManager from '../../bot_res/classes/CronJobManager.js'

/**
 * @module scheduleChannels
 * Use the Cron Time created from {@link collectOdds} to schedule the game channel creation for each game.
 * If the bot is reset, Pluto will collect the corn jobs from the database and schedule them again.
 */

export async function scheduleChannels(
	homeTeam,
	awayTeam,
	args,
) {
	const { scheduledCreationTime, chanName, createNow } =
		args || null
	let openChannelTime = ''
	if (!createNow) {
		openChannelTime = await new CronMath(
			scheduledCreationTime,
		).subtract(1, `hours`)
	} else {
		openChannelTime = scheduledCreationTime
	}
	try {
		const cJobManager = new CronJobManager(Cache)
		await cJobManager.scheduleJob(
			`${chanName}-${openChannelTime}`,
			openChannelTime,
			async () => {
				await createChannel({
					awayTeam,
					homeTeam,
					chanName,
				})
			},
		)
		return true
	} catch (err) {
		Log.Error(`Error scheduling channel | ${chanName}`)
		console.error(err)
		return false
	}
}
