import '@sapphire/plugin-hmr/register'
import {
	LogLevel,
	SapphireClient,
} from '@sapphire/framework'
import { RateLimitManager } from '@sapphire/ratelimits'
import {
	GatewayIntentBits,
	Partials,
	OAuth2Scopes,
} from 'discord.js'
import logClr from './utils/bot_res/ColorConsole.js'
import '#serverConf'
import '@sapphire/plugin-api/register'
import * as api from './utils/api/index.js'

// Start Koa

api.app.listen(5010, async () => {
	await logClr({
		text: `API running at http://localhost:5010`,
		status: `done`,
		color: `green`,
	})
})

// import { startExpress } from './utils/api/requests/middleware.js'

// startExpress()

// Sapphire framework
const SapDiscClient = new SapphireClient({
	auth: {
		// The application/client ID of your bot
		// You can find this at https://discord.com/developers/applications
		id: '983432174361534474',
		// The client secret of your bot
		// You can find this at https://discord.com/developers/applications
		secret: process.env.DISC_SECRET,
		// The name of the authentication cookie
		cookie: 'SAPPHIRE_AUTH',
		// The URL that users should be redirected to after a successful authentication
		redirect: 'http://127.0.0.1:9000/#/betting',
		// The scopes that should be given to the authentication
		scopes: [OAuth2Scopes.Identify],
		// Transformers to transform the raw data from Discord to a different structure.
		transformers: [],
	},
	// The prefix for all routes, e.g. / or v1/
	prefix: '/',
	// The origin header to be set on every request at 'Access-Control-Allow-Origin.
	origin: '*',
	// Any options passed to the NodeJS "net" internal server.listen function
	// See https://nodejs.org/api/net.html#net_server_listen_options_callback
	listenOptions: {
		// The port the API will listen on
		port: 4000,
	},
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
