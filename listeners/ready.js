import { Listener } from '@sapphire/framework';
import { logthis } from "../lib/PlutoConfig.js";
export class ReadyListener extends Listener {
  run(SapDiscClient) {
    const {
      username,
      id
    } = SapDiscClient.user;
  }
}



logthis(`readyjs loaded`);