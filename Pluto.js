import '@sapphire/plugin-hmr/register'
import 'dotenv/config'

import { LogLevel, SapphireClient } from '@sapphire/framework'
import { bold, green, logthis, yellowBright } from './lib/PlutoConfig.js'

import { RateLimitManager } from '@sapphire/ratelimits'

console.log(yellowBright(bold(`[Startup]: Launching Pluto`)))

// Sapphire framework
const SapDiscClient = new SapphireClient({
    caseInsensitiveCommands: true,
    ignoreBots: false,
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
        level: LogLevel.Debug,
    },
    typing: true,
    loadMessageCommandListeners: true,
})

SapDiscClient.fetchPrefix = () => '?'

async function LoginPluto() {
    // eslint-disable-next-line
    const envTOKEN = process.env.TOKEN
    SapDiscClient.login(envTOKEN)
    logthis(green(`[Startup] Pluto is now online!`))
}
LoginPluto()

export { SapDiscClient }
export { RateLimitManager }
