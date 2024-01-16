import { Listener } from '@sapphire/framework'
import logClr from '../utils/bot_res/ColorConsole.js'
import { dbDailyOps } from '../utils/scheduled/dailyModules.js'
import '../utils/api/index.js'

// eslint-disable-next-line no-unused-vars
export class ReadyListener extends Listener {
	constructor(context, options) {
		super(context, {
			...options,
			once: true,
			event: 'ready',
		})
	}

	run(SapDiscClient) {
		const {
			username, // eslint-disable-line
			id, // eslint-disable-line
		} = SapDiscClient.user
	}
}
/** On a timeout to ensure bot is logged in. */
setTimeout(async () => {
	logClr({
		text: `Running On-Load Processes`,
		color: `yellow`,
		mark: `🕒`,
	})
	// # Start-Up Operation: Check for game channels to be scheduled on restart

	await dbDailyOps()
	logClr({
		text: `[Startup]: On-Load Processes completed!`,
		mark: `✅`,
		color: `green`,
	})
}, 5000)
