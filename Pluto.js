import '@sapphire/plugin-hmr/register'
import 'dotenv/config'

import { Log } from './utils/bot_res/send_functions/consoleLog.js'
import { RateLimitManager } from '@sapphire/ratelimits'
import { SapphireClient } from '@sapphire/framework'

Log.Yellow('Starting Pluto...')

// Sapphire framework
const SapDiscClient = new SapphireClient({
	caseInsensitiveCommands: true,
	ignoreBots: false,
	intents: ['GUILDS', 'GUILD_MESSAGES'],
	presence: {
		status: 'Online!',
	},
	typing: true,
})

SapDiscClient.fetchPrefix = () => '?'

async function LoginPluto() {
	// eslint-disable-next-line
	const envTOKEN = process.env.TOKEN
	SapDiscClient.login(envTOKEN)
	Log.Green('Pluto logged in!')
}
LoginPluto()

export { SapDiscClient }
export { RateLimitManager }
