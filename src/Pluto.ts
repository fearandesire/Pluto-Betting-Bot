import '@pluto-server-config'
import '@sapphire/plugin-hmr/register'
import { LogLevel, SapphireClient } from '@sapphire/framework'
import { RateLimitManager } from '@sapphire/ratelimits'
import { GatewayIntentBits, Partials } from 'discord.js'
import { blue, bold, green, red, yellow } from 'colorette'
import './utils/api/index.js'
// import '@sapphire/plugin-api/register'

const SapDiscClient = new SapphireClient({
	defaultPrefix: process.env.PREFIX,
	caseInsensitiveCommands: true,
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
	logger: {
		level: LogLevel.Debug,
	},
	typing: true,
	loadMessageCommandListeners: true,
})

console.log(bold(yellow(`[Startup]`)), `Launching Pluto`)
const login = async () => {
	try {
		await SapDiscClient.login(process.env.TOKEN)
		await console.log(bold(green(`[Startup]`)), `Pluto is up and running!`)
	} catch (error) {
		await console.log(bold(red(`[Startup]`)), `Failed to login`)
		SapDiscClient.logger.fatal(error)
		SapDiscClient.destroy()
		process.exit(1)
	}
	await console.log(bold(blue(`[Startup]`)), `Index ops complete!`)
}
login()

export { SapDiscClient }
export { RateLimitManager }
