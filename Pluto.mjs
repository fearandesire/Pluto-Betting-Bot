import '@kaname-png/plugin-statcord/register'
import '@sapphire/plugin-hmr/register'
import 'dotenv/config'

import { LogLevel, SapphireClient } from '@sapphire/framework'

import { Log } from '#config'
import { RateLimitManager } from '@sapphire/ratelimits'

Log.Magenta(`[Startup]: Initializing Pluto`)

// Sapphire framework
const SapDiscClient = new SapphireClient({
    defaultPrefix: process.env.PREFIX,
    caseInsensitiveCommands: true,
    ignoreBots: false,
    shards: `auto`,
    intents: [
        'GUILDS',
        'GUILD_MEMBERS',
        'GUILD_BANS',
        'GUILD_EMOJIS_AND_STICKERS',
        'GUILD_VOICE_STATES',
        'GUILD_MESSAGES',
        'GUILD_MESSAGE_REACTIONS',
        'DIRECT_MESSAGES',
        'DIRECT_MESSAGE_REACTIONS',
    ],
    presence: {
        status: 'Online!',
    },
    logger: {
        level: LogLevel[`${process.env.logLevel}`],
    },
    typing: true,
    loadMessageCommandListeners: true,
    statcord: {
        client_id: `${process.env.botsId}`,
        key: process.env.STATCORD_KEY,
        autopost: true, // (Optional) Allows automatic posting of statistics.
        debug: false, // (Optional) Show debug messages.
        sharding: false, // (Optional) Activate the sharding mode, it is important to read the notes below.
    },
})

const loginClient = async () => {
    try {
        Log.Yellow(`[Startup]: Logging in Pluto to Discord..`)
        await SapDiscClient.login(process.env.TOKEN)
        Log.Green(
            `[Startup]: Logged in successfully!\nID: ${SapDiscClient.user.id}`,
        )
    } catch (error) {
        SapDiscClient.logger.fatal(error)
        SapDiscClient.destroy()
        process.exit(1)
    }
}
loginClient()

export { SapDiscClient }
export { RateLimitManager }
