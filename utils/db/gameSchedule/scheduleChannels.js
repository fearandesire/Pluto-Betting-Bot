import { createRequire } from 'module'
import { createChannel } from './createChannel.js'
import CronMath from './CronMath.js'

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
	const createSchedCron = async () => {
		await cron.schedule(
			`${openChannelTime}`,
			async () => {
				await createChannel({
					awayTeam,
					homeTeam,
					chanName,
				})
			},
			{ timezone: 'America/New_York' },
		)
	}
	await createSchedCron()
	return true
}
