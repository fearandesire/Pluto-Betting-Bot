import {
	ApplicationCommandRegistries,
	LogLevel,
	RegisterBehavior,
	SapphireClient,
} from '@sapphire/framework'
import '@sapphire/plugin-hmr/register'
import { GatewayIntentBits, Partials } from 'discord.js'
import { startPluto } from './lib/startup/pluto.js'
import { getDefaultAlertReporter } from './services/alerts/alert-reporter.js'
import { GatewayConnectivityMonitor } from './services/alerts/failure-trackers.js'
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

const gatewayMonitor = new GatewayConnectivityMonitor({
	firing: async (input) => getDefaultAlertReporter()?.firing(input),
	resolved: async (input) => getDefaultAlertReporter()?.resolved(input),
})
SapDiscClient.on('shardDisconnect', (_event, shardId) => {
	gatewayMonitor.disconnected(String(shardId))
})
SapDiscClient.on('shardReady', (shardId) => {
	void gatewayMonitor.ready(String(shardId)).catch((error) => {
		logger.error({
			event: 'gateway.recovery_tracking_failed',
			error: error instanceof Error ? error.name : 'unknown',
		})
	})
})

ApplicationCommandRegistries.setDefaultBehaviorWhenNotIdentical(
	RegisterBehavior.BulkOverwrite,
)

logger.info({
	message: 'Pluto is starting up',
})

void startPluto({ client: SapDiscClient })

export { SapDiscClient }
