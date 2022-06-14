import { Listener } from '@sapphire/framework';
import { LogGreen } from '../utils/ConsoleLogging.js';
import { dailyclaim } from '../utils/dailyclaim.js';
import { useridentity } from '../utils/useridentity.js';
export class ReadyListener extends Listener {
  run(SapDiscClient) {
    const {
      username, // eslint-disable-line 
      id // eslint-disable-line
    } = SapDiscClient.user;
  }
}

useridentity();

dailyclaim();
LogGreen(`[Startup]: ready.js has loaded!`);