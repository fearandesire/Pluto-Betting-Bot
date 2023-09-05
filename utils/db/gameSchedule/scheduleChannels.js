import { createRequire } from 'module'
import { createChannel } from './createChannel.js'
import { getShortName } from '../../bot_res/getShortName.js'
import CronMath from './CronMath.js'
import logClr from '#colorConsole'
import Cache from '#rCache'
import PlutoLogger from '#PlutoLogger'

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
	const { cronStartTime, queueEarly, gameId } =
		options || null
	let openChannelTime

	if (queueEarly) {
		openChannelTime = await new CronMath(
			cronStartTime,
		).subtract(1, `hours`)
	} else {
		openChannelTime = cronStartTime
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
		await PlutoLogger.log({
			id: `2`,
			description: `Game Scheduled | ${homeTeam} vs ${awayTeam}`,
		})
	})
	return true
}
