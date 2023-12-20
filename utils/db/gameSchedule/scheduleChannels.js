import { createRequire } from 'module'
import logClr from '@pluto-internal-color-logger'
import Cache from '@pluto-redis'
import { createChannel } from './createChannel.js'
import { getShortName } from '../../bot_res/getShortName.js'
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
	options,
) {
	const { scheduledCreationTime, queue1HEarly, gameId } =
		options || null
	let openChannelTime

	if (queue1HEarly) {
		openChannelTime = await new CronMath(
			scheduledCreationTime,
		).subtract(1, `hours`)
	} else {
		openChannelTime = scheduledCreationTime
	}
	const HTEAM = await getShortName(homeTeam)
	const ATEAM = await getShortName(awayTeam)

	const createSchedCron = async () => {
		await cron.schedule(
			`${openChannelTime}`,
			async () => {
				const creation = await createChannel({
					awayTeam: ATEAM,
					homeTeam: HTEAM,
				})
				if (creation) {
					const cachedIds = await Cache().get(
						`scheduledIds`,
					)
					// Find and remove game from cache via ID
					const newIds = cachedIds.filter(
						(id) => id !== gameId,
					)
					await Cache().set(
						`scheduledIds`,
						newIds,
					)
					await logClr({
						text: `Removed game from cache`,
						color: `green`,
						status: `done`,
					})
				}
			},
			{ timezone: 'America/New_York' },
		)
	}
	await createSchedCron().then(async () => {
		// ! TODO: Create Adv. Logging toggle
		// await PlutoLogger.log({
		// 	id: 2,
		// 	description: `Game Scheduled | ${homeTeam} vs ${awayTeam}`,
		// })
	})
	return true
}
