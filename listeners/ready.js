/* eslint-disable no-unused-vars */

import { Listener } from '@sapphire/framework'
import { Log } from '../utils/bot_res/send_functions/consoleLog.js'

export class ReadyListener extends Listener {
	run(SapDiscClient) {
		const { username, id } = SapDiscClient.user
	}
}

Log.Green(`[Startup]: ready.js has loaded!`)
