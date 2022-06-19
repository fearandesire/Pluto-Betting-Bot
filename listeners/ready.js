import { Listener } from '@sapphire/framework';
<<<<<<< Updated upstream
import { logthis } from "../lib/PlutoConfig.js";
=======
import {Log} from '../utils/ConsoleLogging.js'
// eslint-disable-next-line no-unused-vars
>>>>>>> Stashed changes
export class ReadyListener extends Listener {
  run(SapDiscClient) {
    const {
      username,
      id
    } = SapDiscClient.user;
  }
}

<<<<<<< Updated upstream


logthis(`readyjs loaded`);
=======
Log.LogGreen(`[Startup]: ready.js has loaded!`);
>>>>>>> Stashed changes
