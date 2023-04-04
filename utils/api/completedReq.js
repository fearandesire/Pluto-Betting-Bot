import { createRequire } from 'module'
import { Log, CHECK_COMPLETED_TIMER } from '#config'

import { completedReqLog } from '#winstonLogger'
import { isGameDay } from '#botUtil/isGameDay'
import { checkCompleted } from './checkCompleted.js'
import { resolveCompCron } from '../db/gameSchedule/resolveCompCron.js'
import { reply } from '../bot_res/reply.js'

const require = createRequire(import.meta.url)
const cron = require('node-cron')

/**
 * @module completedReq -
 * Executed daily, this module will setup a sequence of Cron Jobs for API Calls to check the status of games/completed games.
 * The Cron Jobs are generated via {@link resolveCompCron} and are based on the games scheduled for the day.
 */

export function completedReq() {
	completedReqLog.info(`Running completedReq.js`)
	/** `CHECK_COMPLETED_TIMER` is a Cron String provided in the `.env` file; This will dictate schedule to run `{@link resolveCompCron}`
	 * This is set to run daily after the schedule ({@link scheduleReq}) has been collected.
	 */
	this.dailyCheck = async function () {
		await Log.Green(
			`[Startup]: completedReq > dailyCheck initialized on schedule of: ${CHECK_COMPLETED_TIMER}`,
		)
		const checkGameDay = await isGameDay()
		let completedCron
		cron.schedule(
			`${CHECK_COMPLETED_TIMER}`,
			async () => {
				// # Retrieve the cron ranges for the times we will be checking for completed games -- in the Cron format
				completedCron = await resolveCompCron()
				const cronRange1 = completedCron?.range1
					? completedCron.range1
					: undefined
				const cronRange2 = completedCron?.range2 ?? undefined
				completedReqLog.info(
					`[completedReq.js] Cron Range Hours:\nRange 1: ${cronRange1}\nRange 2: ${cronRange2}`,
				)
				Log.Blue(
					`[completedReq.js]\nRes from \`resolveCompCron\`\nCron Range Hours:\nRange 1: ${cronRange1}\nRange 2: ${cronRange2}`,
				)
				if (checkGameDay == true && cronRange1 !== undefined) {
					cron.schedule(
						cronRange1,
						async () => {
							await completedReqLog.info(
								`[Range 1] Checking for completed games..`,
							)
							await Log.Yellow(`Checking for completed games`)
							await checkCompleted()
						},
						{ timezone: 'America/New_York' },
					)
					if (cronRange2 !== undefined) {
						cron.schedule(
							cronRange2,
							async () => {
								await completedReqLog.info(
									`[Range 2] Checking for completed games..`,
								)
								await Log.Yellow(`Checking for completed games`)
								await checkCompleted()
							},
							{ timezone: 'America/New_York' },
						)
					}
				} else {
					Log.Red(
						`[completedReq.js] No games today, skipping completed game check..`,
					)
					completedReqLog.info(
						`[completedReq.js] No games today, skipping completed game check`,
					)
				}
			},
			{ timezone: 'America/New_York' },
		)
	}
	// # Force execution of the checkCompleted function via CMD {@link forceCheck}
	this.forceCheck = async function () {
		await checkCompleted()
	}
	// #  Called via CMD to call for creation of the Cron Jobs
	this.restartedCheck = async function (interaction) {
		const checkGameDay = await isGameDay()
		if (checkGameDay === true) {
			const completedCron = await resolveCompCron()
			const cronRange1 = completedCron?.range1
			const cronRange2 = completedCron?.range2
			completedReqLog.info(
				`Cron Range Hours:\nRange 1: ${cronRange1}\nRange 2: ${cronRange2}`,
			)
			Log.Blue(
				`[completedReq.js]\nCron Range Hours:\nRange 1: ${cronRange1}\nRange 2: ${cronRange2}`,
			)
			if (cronRange1) {
				cron.schedule(
					cronRange1,
					async () => {
						await completedReqLog.info(
							`[Range 1] Checking for completed games..`,
						)
						await Log.Yellow(`Checking for completed games`)
						await checkCompleted()
					},
					{ timezone: 'America/New_York' },
				)

				if (cronRange2) {
					cron.schedule(
						cronRange2,
						async () => {
							await completedReqLog.info(
								`[Range 2] Checking for completed games..`,
							)
							await Log.Yellow(`Checking for completed games`)
							await checkCompleted()
						},
						{ timezone: 'America/New_York' },
					)
				}
			}
			if (interaction) {
				await reply(interaction, {
					content: `Initialized Cron Jobs for checking for completed games.`,
					ephemeral: true,
				})
			}
		} else {
			completedReqLog.info({
				state: 'ok',
				message: `No games today, skipping completed game check..`,
			})
			Log.Red(
				`[completedReq.js] No games today, skipping completed game check..`,
			)
			await reply(interaction, {
				content: 'No games were found for today.',
				ephemeral: true,
			})
		}
	}
}
