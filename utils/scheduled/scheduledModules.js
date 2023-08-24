import { Cron } from 'croner'
import { dmMe } from '#config'
import {
    CRON_CHECK_COMPLETED,
    CRON_SCHEDULE_GAMES,
} from '#env'
import { preseasonGameHeartbeat } from '../api/gameHeartbeat.js'
import logClr from '#colorConsole'
import schedulePreseasonGames from '../db/gameSchedule/schedulePreseasonGames.js'

export async function cronHeartbeat() {
    logClr({
        text: `Init Cron Job for Game Heartbeat`,
        color: `yellow`,
        status: `processing`,
    })
    // # Run Cron every 10 minutes to check for completed games & score
    const cron = new Cron(
        `${CRON_CHECK_COMPLETED}`,
        async () => {
            try {
                await preseasonGameHeartbeat()
            } catch (err) {
                await logClr({
                    text: err,
                    color: 'red',
                    status: 'error',
                })
                await dmMe(
                    `Error occured when checking heartbeat of games`,
                )
            }
        },
    )
}

export async function cronChanScheduler(preszn) {
    logClr({
        text: `Init Cron Job for Scheduling Game Channels`,
        color: `yellow`,
        status: `processing`,
    })
    if (preszn) {
        // # Run Cron every day at 2 AM to schedule new games
        const cron = new Cron(
            `${CRON_SCHEDULE_GAMES}`,
            async () => {
                await schedulePreseasonGames()
            },
        )
    }
}
