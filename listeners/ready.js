/* eslint-disable no-unused-vars */
import { Listener } from '@sapphire/framework';
import { Log } from '../utils/ConsoleLogging.js';
export class ReadyListener extends Listener {
  run(SapDiscClient) {
    const {
      username,
      id
    } = SapDiscClient.user;
  }
}

Log.LogGreen(`[Startup]: ready.js has loaded!`);
