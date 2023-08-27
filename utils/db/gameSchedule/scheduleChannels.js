import { createRequire } from 'module'
import { createChannel } from './createChannel.js'
import { getShortName } from '../../bot_res/getShortName.js'
import { cronMath } from './cronMath.js'
import logClr from '#colorConsole'

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
	const { cronStartTime, notSubtracted, id } =
		options || null
	let newCron
	if (notSubtracted) {
		newCron = await new cronMath(
			cronStartTime,
		).subtract(1, `hours`)
	} else {
		newCron = cronStartTime
	}

	const HTEAM = await getShortName(homeTeam)
	const ATEAM = await getShortName(awayTeam)
	const createCron = async () => {
		await cron.schedule(
			`${newCron}`,
			async () => {
				await createChannel({
					ATEAM,
					HTEAM,
					id,
				})
			},
			{ timezone: 'America/New_York' },
		)
	}
	await createCron().then(async () => {
		await logClr({
			text: `Scheduled: ${ATEAM} vs ${HTEAM}`,
			color: 'green',
			status: `done`,
		})
	})
	return true
}
