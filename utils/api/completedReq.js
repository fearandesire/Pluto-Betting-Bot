import { Log, NBA_COLLECT_CRONTIMES } from '#config'

import { checkCompleted } from './checkCompleted.js'
import { completedReqLog } from '#winstonLogger'
import { createRequire } from 'module'
import { isGameDay } from '#botUtil/isGameDay'
import { resolveCompCron } from '../db/gameSchedule/resolveCompCron.js'
import stringifyObject from 'stringify-object'

const require = createRequire(import.meta.url)
const cron = require('cronitor')(`f9f7339479104e79bf2b52eb9c2242bf`)
cron.wraps(require('node-cron'))
const compGameMonitor = new cron.Monitor('Completed Game Monitor')

/**
 * @module completedReq -
 * Setup a sequence of Cron Jobs to create API Calls to check for completed games based on the earliest and latest game times for the day.
 */

export function completedReq() {
    Log.Yellow(`[Startup]: completedReq.js reached`)

    this.dailyCheck = async function () {
        var checkGameDay = await isGameDay()
        var completedCron = await resolveCompCron()
        cron.schedule(
            `initGameDay`,
            `${NBA_COLLECT_CRONTIMES}`,
            async () => {
                completedReqLog.info(`Running completedReq.js - Initializing Cron Jobs`)
                compGameMonitor.ping({
                    state: `ok`,
                    message: `Initializing finished game check Cron Job [completedReq.js]`,
                })
                var cronRange1 = completedCron?.range1
                var cronRange2 = completedCron?.range2
                var stringified = stringifyObject(completedCron)
                completedReqLog.info(`Cron Range Hours:\n${stringified}`)
                Log.Blue(
                    `[completedReq.js]\nGame Day!\nCron Range Hours: ${stringified}`,
                )
                if (checkGameDay == true && cronRange1 !== undefined) {
                    cron.schedule(
                        `compGamesRange1`,
                        cronRange1,
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
                    if (cronRange2 !== undefined) {
                        Log.Green(`Checking for completed games between the hours:`)
                        console.log(cronRange2)
                        cron.schedule(
                            `CompletedGameCheck`,
                            cronRange2,
                            async () => {
                                compGameMonitor.ping({
                                    state: 'run',
                                    message: `Checking for completed games..`,
                                })
                                await checkCompleted(compGameMonitor)
                                Log.Yellow(`Checking for completed games`)
                            },
                            { timezone: 'America/New_York' },
                        )
                    }
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
    //# Intended to be used on bot-restarts
    this.restartedCheck = async function (interaction) {
        var checkGameDay = await isGameDay()
        if (checkGameDay == true) {
            var completedCron = await resolveCompCron()
            var cronRange1 = completedCron?.range1
            var cronRange2 = completedCron?.range2
            var stringified = stringifyObject(completedCron)
            completedReqLog.info(`Cron Range Hours:\n${stringified}`)
            Log.Blue(`[completedReq.js]\nGame Day!\nCron Range Hours: ${stringified}`)
            if (cronRange1) {
                cron.schedule(
                    `compGamesRange1`,
                    cronRange1,
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
                if (cronRange2) {
                    Log.Green(`Checking for completed games between the hours:`)
                    console.log(cronRange2)
                    cron.schedule(
                        `compRange2`,
                        cronRange2,
                        async () => {
                            compGameMonitor.ping({
                                state: 'run',
                                message: `Checking for completed games..`,
                            })
                            await checkCompleted(compGameMonitor)
                            Log.Yellow(`Checking for completed games`)
                        },
                        { timezone: 'America/New_York' },
                    )
                }
            }
            interaction.reply({
                content: `Successfully collected the time range.`,
                ephemeral: true,
            })
            return
        } else {
            completedReqLog.log({
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
