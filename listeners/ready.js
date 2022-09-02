import { Listener } from '@sapphire/framework'
import { Log } from '#LogColor'

// eslint-disable-next-line no-unused-vars
export class ReadyListener extends Listener {
    run(SapDiscClient) {
        const { username, id } = SapDiscClient.user
    }
}

Log.Green(`[Startup]: ready.js has loaded!`)
