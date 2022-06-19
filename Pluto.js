import { SapphireClient } from '@sapphire/framework';
import '@sapphire/plugin-hmr/register';
import { RateLimitManager } from '@sapphire/ratelimits';
import 'dotenv/config';
import { bold, green, logthis, yellowBright } from './lib/PlutoConfig.js';

console.log(yellowBright(bold(`[Startup]: Launching Pluto`)))

// Sapphire framework
const SapDiscClient = new SapphireClient({
  caseInsensitiveCommands: true,
  ignoreBots: false,
  intents: ["GUILDS", "GUILD_MESSAGES"],
  presence: {
    status: 'Online!'
  },
  typing: true
});

SapDiscClient.fetchPrefix = () => "?";

async function LoginPluto() {
  // eslint-disable-next-line
  const envTOKEN = process.env.TOKEN
   SapDiscClient.login(envTOKEN)
   logthis(green(`[Startup] Pluto is now online!`))
}
LoginPluto();

export { SapDiscClient };
export { RateLimitManager };

