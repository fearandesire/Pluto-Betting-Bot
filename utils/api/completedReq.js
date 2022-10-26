import { Log } from '#config'
import { checkCompleted } from './checkCompleted.js'
import { completedReqLog } from '#winstonLogger'
import { createRequire } from 'module'
import { isGameDay } from '#botUtil/isGameDay'
import { resolveCompCron } from '../db/gameSchedule/resolveCompCron.js'

const require = createRequire(import.meta.url)
const cron = require('cronitor')(`f9f7339479104e79bf2b52eb9c2242bf`)
cron.wraps(require('node-cron'))
const compGameMonitor = new cron.Monitor('Completed Game Monitor')

/**
 * @module completedReq -
 * Setup a sequence of  API Calls to check for completed games every 15 minutes starting from the earliest NFL Game Times.
 * According to the NFL Schedule. Mondays, Thursdays & Sundays are game days
 * Schedule Times stay consistent:
 * - Monday: 10:00  PM
 * - Sunday; 3:00 PM
 * - Thursday 10:00 PM
 */

export function completedReq() {
    Log.Yellow(`[Startup]: completedReq.js reached`)
    this.dailyCheck = async function () {
        cron.schedule(
            `initGameDay`,
            '1 0 * * *',
            async () => {
                completedReqLog.info(`Running completedReq.js - Initializing Cron Jobs`)
                compGameMonitor.ping({
                    state: `ok`,
                    message: `Initializing finished game check Cron Job [completedReq.js]`,
                })
                var checkGameDay = await isGameDay()
                if (checkGameDay == true) {
                    var completedCron = await resolveCompCron()
                    completedReqLog.info(
                        `Checking for completed games between the hours: ${completedCron}`,
                    )
                    Log.Green(
                        `Checking for completed games between the hours: ${completedCron}`,
                    )
                    cron.schedule(
                        `CompletedGameCheck`,
                        `${completedCron}`,
                        async () => {
                            completedReqLog.info(`Checking for completed games..`)
                            compGameMonitor.ping({
                                state: 'run',
                                message: `Checking for completed games..`,
                            })
                            await checkCompleted(compGameMonitor)
                            Log.Yellow(`Checking for completed games`)
                        },
                        { timezone: 'America/New_York' },
                    )
                } else {
                    completedReqLog.ping({
                        state: 'ok',
                        message: `No games today, skipping completed game check..`,
                    })
                    Log.Red(
                        `[completedReq.js] No games today, skipping completed game check..`,
                    )
                    return
                }
            },
            { timezone: 'America/New_York' },
        )
    }
    //# to have a command added to force check for completed games
    this.forceCheck = async function (interaction) {
        await checkCompleted(compGameMonitor)
    }
    //# to have a command linked to collect the cron string for the completed game checks for the day
    this.restartedCheck = async function (interaction) {
        var checkGameDay = await isGameDay()
        if (checkGameDay == true) {
            var completedCron = await resolveCompCron()
            completedReqLog.info(
                `Checking for completed games between the hours: ${completedCron}`,
            )
            Log.Green(
                `Checking for completed games between the hours: ${completedCron}`,
            )
            cron.schedule(
                `CompletedGameCheck`,
                `${completedCron}`,
                async () => {
                    completedReqLog.info(`Checking for completed games..`)
                    compGameMonitor.ping({
                        state: 'run',
                        message: `Checking for completed games..`,
                    })
                    await checkCompleted(compGameMonitor)
                    Log.Yellow(`Checking for completed games`)
                },
                { timezone: 'America/New_York' },
            )
        } else {
            completedReqLog.ping({
                state: 'ok',
                message: `No games today, skipping completed game check..`,
            })
            Log.Red(
                `[completedReq.js] No games today, skipping completed game check..`,
            )
            await interaction.reply({
                content: `No games are scheduled for today.`,
                ephemeral: true,
            })
            return
        }
    }
}
