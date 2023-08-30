import '@kaname-png/plugin-statcord/register'
import '@sapphire/plugin-hmr/register'
import {
	LogLevel,
	SapphireClient,
} from '@sapphire/framework'
import { RateLimitManager } from '@sapphire/ratelimits'
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
