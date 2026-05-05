import {
	ApplicationCommandRegistries,
	LogLevel,
	RegisterBehavior,
	SapphireClient,
} from '@sapphire/framework'
import '@sapphire/plugin-hmr/register'
import { GatewayIntentBits, Partials } from 'discord.js'
import env from './lib/startup/env.js'
import { logger } from './utils/logging/WinstonLogger.js'

const SapDiscClient = new SapphireClient({
	caseInsensitiveCommands: true,
	shards: 'auto',
	intents: [
		GatewayIntentBits.DirectMessageReactions,
		GatewayIntentBits.DirectMessages,
		GatewayIntentBits.GuildExpressions,
		GatewayIntentBits.GuildMembers,
		GatewayIntentBits.GuildMessageReactions,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildVoiceStates,
		GatewayIntentBits.MessageContent,
	],
	partials: [Partials.Channel],
	logger: {
		level: LogLevel.Info,
	},
	typing: true,
	loadMessageCommandListeners: true,
})

ApplicationCommandRegistries.setDefaultBehaviorWhenNotIdentical(
	RegisterBehavior.BulkOverwrite,
)

logger.info({
	message: 'Pluto is starting up',
})

const initializeStartupServices = async () => {
	if (env.USE_MOCK_DATA) {
		logger.info({
			message:
				'Mock data mode enabled; skipping Redis-backed startup services',
			source: 'startup:mock-data',
		})
		return
	}

	await import('./lib/startup/cache.js')
	await import('./utils/api/Khronos/KhronosInstances.js')
	await import('./utils/api/koa/index.js')
	await import('./utils/cache/queue/ChannelCreationQueue.js')
	await import('./utils/cron/index.js')
}

const login = async () => {
	try {
		await initializeStartupServices()
		await SapDiscClient.login(process.env.TOKEN)
		logger.info('Pluto is up and running!')
	} catch (error) {
		logger.error({
			message: 'Failed to login',
		})
		SapDiscClient.logger.fatal(error)
		SapDiscClient.destroy()
		process.exit(1)
	}
}
login()

export { SapDiscClient }
