import "./lib/startup/env.js";
import "./utils/cache/queue/ChannelCreationQueue.js";
import "./utils/api/Khronos/KhronosInstances.js";
import "./lib/startup/cache.js";
import "./utils/api/koa/index.js";
import {
  ApplicationCommandRegistries,
  LogLevel,
  RegisterBehavior,
  SapphireClient,
} from "@sapphire/framework";
import { GatewayIntentBits, Partials } from "discord.js";
import "@sapphire/plugin-hmr/register";
import { logger } from "./utils/logging/WinstonLogger.js";
const SapDiscClient = new SapphireClient({
  caseInsensitiveCommands: true,
  shards: "auto",
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
});

ApplicationCommandRegistries.setDefaultBehaviorWhenNotIdentical(
  RegisterBehavior.BulkOverwrite,
);

logger.info({
  message: "Pluto is starting up",
});
const login = async () => {
  try {
    await SapDiscClient.login(process.env.TOKEN);
    logger.info("Pluto is up and running!");
  } catch (error) {
    logger.error({
      message: "Failed to login",
    });
    SapDiscClient.logger.fatal(error);
    SapDiscClient.destroy();
    process.exit(1);
  }
};
login();

export { SapDiscClient };
