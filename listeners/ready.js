import { Listener } from '@sapphire/framework';
import { LogGreen } from '../utils/ConsoleLogging.js';
export class ReadyListener extends Listener {
  run(SapDiscClient) {
    const {
      username, // eslint-disable-line 
      id // eslint-disable-line
    } = SapDiscClient.user;
  }
}



LogGreen(`[Startup]: ready.js has loaded!`);