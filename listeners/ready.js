import { Listener } from '@sapphire/framework';
import { Log } from '../utils/ConsoleLogging.js';
// eslint-disable-next-line no-unused-vars
export class ReadyListener extends Listener {
  run(SapDiscClient) {
    const {
      username,
      id
    } = SapDiscClient.user;
  }
}

Log.LogGreen(`[Startup]: ready.js has loaded!`);
