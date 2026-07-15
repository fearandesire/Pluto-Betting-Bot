import {
	ApplicationCommandRegistries,
	LogLevel,
	RegisterBehavior,
	SapphireClient,
} from '@sapphire/framework'
import '@sapphire/plugin-hmr/register'
import { GatewayIntentBits, Partials } from 'discord.js'
import { startPluto } from './lib/startup/pluto.js'
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
		level: LogLevel.Debug,
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

void startPluto({ client: SapDiscClient })

export { SapDiscClient }
