import '@sapphire/plugin-hmr/register'
import {
	LogLevel,
	SapphireClient,
} from '@sapphire/framework'
import { RateLimitManager } from '@sapphire/ratelimits'
import { GatewayIntentBits, Partials } from 'discord.js'
import logClr from './utils/bot_res/ColorConsole.js'
import '#serverConf'

// import { startExpress } from './utils/api/requests/middleware.js'

// startExpress()

// Sapphire framework
const SapDiscClient = new SapphireClient({
	defaultPrefix: process.env.PREFIX,
	caseInsensitiveCommands: true,
	ignoreBots: false,
	shards: `auto`,
	intents: [
		GatewayIntentBits.DirectMessageReactions,
		GatewayIntentBits.DirectMessages,
		GatewayIntentBits.GuildBans,
		GatewayIntentBits.GuildEmojisAndStickers,
		GatewayIntentBits.GuildMembers,
		GatewayIntentBits.GuildMessageReactions,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildVoiceStates,
		GatewayIntentBits.MessageContent,
	],
	partials: [Partials.Channel],
	presence: {
		status: 'Online!',
	},
	logger: {
		level: LogLevel[`${process.env.logLevel}`],
	},
	typing: true,
	loadMessageCommandListeners: true,
})

await logClr({
	text: `[Startup]: Logging Pluto in to Discord\n`,
	status: `processing`,
	color: `yellow`,
})
const login = async () => {
	try {
		await SapDiscClient.login(process.env.TOKEN)
	} catch (error) {
		await logClr({
			text: `[Startup]: Error logging in to Discord!`,
			status: `error`,
			color: `red`,
		})
		SapDiscClient.logger.fatal(error)
		SapDiscClient.destroy()
		process.exit(1)
	} finally {
		await logClr({
			text: `[Startup]: Logged in to Discord!`,
			status: `done`,
			color: `green`,
		})
	}
}
login()

export { SapDiscClient }
export { RateLimitManager }
