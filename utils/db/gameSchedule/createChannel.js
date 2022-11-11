import { SapDiscClient } from '#main'
import { createChanLog } from '#winstonLogger'
import { createRequire } from 'module'
import { dmMe } from '../../bot_res/dmMe.js'

const require = createRequire(import.meta.url)
const cron = require('cronitor')(`f9f7339479104e79bf2b52eb9c2242bf`)
cron.wraps(require('node-cron'))
const gameCreateMonitor = new cron.Monitor('Create Game Channels')

/**
 * @module createChannel
 * Create game channel in the live games category
 */

export async function createChannel(awayTeam, homeTeam) {
    createChanLog.info(
        `Creating Game Channel | Title: ${awayTeam} at ${homeTeam}`,
    )
    await gameCreateMonitor.ping({
        state: `run`,
        message: `Creating Game Channel for: ${awayTeam} at ${homeTeam}`,
    })
    try {
        const guild = SapDiscClient.guilds.cache.get(`${process.env.server_ID}`)
        const category = guild.channels.cache.get(`${process.env.gameCat_ID}`)
        const channelName = `${awayTeam} at ${homeTeam}`
        var gameChan = await guild.channels.create(channelName, {
            type: 'text',
            topic: `Enjoy the Game!`,
            parent: category,
        })
        //# Wish a random team good luck
        var teamChoices = [homeTeam, awayTeam]
        var goodLuck = Math.floor(Math.random() * teamChoices.length)
        await gameChan.send(`Good luck to the ${teamChoices[goodLuck]}!`)
        await dmMe(
            `${channelName} Game Channel created successfully\nDirect Link: <#${gameChan.id}>`,
            `#00ff00`,
            `Game Channel Creation`,
        )
        createChanLog.info(`Game Channel Created: ${channelName}`)
        await gameCreateMonitor.ping({
            state: `complete`,
            message: `${channelName} Game Channel created successfully`,
        })
        return
    } catch (error) {
        createChanLog.error(`Error Creating Game Channel: ${error}`)
        await gameCreateMonitor.ping({
            state: `fail`,
            message: `Error Creating Game Channel: ${error}`,
        })
        return
    }
}
