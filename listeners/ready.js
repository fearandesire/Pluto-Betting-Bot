import { scheduleReq } from '#api/scheduleReq'
import { embedReply } from '#config'
import { Log } from '#LogColor'
import { Listener } from '@sapphire/framework'
import { createRequire } from 'module'
import { completedReq } from '../utils/api/completedReq.js'

const require = createRequire(import.meta.url)
const cron = require('cronitor')(`f9f7339479104e79bf2b52eb9c2242bf`)
cron.wraps(require('node-cron'))

// eslint-disable-next-line no-unused-vars
export class ReadyListener extends Listener {
	run(SapDiscClient) {
		const { username, id } = SapDiscClient.user
	}
}

setTimeout(async () => {
	await scheduleReq().then(() => {
		var embedObj = {
			title: `Schedule Queue`,
			description: `The Weekly schedule queue has been started!\nSchedule Information: **Every Tuesday @ 2:00 AM EST**`,
			color: 'GREEN',
			target: 'modBotSpamID',
			footer: 'Pluto | Designed by FENIX#7559',
		}
		embedReply(null, embedObj)
	})
	await completedReq().then(() => {
		var embedObj = {
			title: `Game Day Queue`,
			description: `Initiated the game completed queue!\nChecking for completed games **every 15 minutes after 10:00 PM EST**`,
			color: '#00ffff',
			target: 'modBotSpamID',
			footer: 'Pluto | Designed by FENIX#7559',
		}
		embedReply(null, embedObj)
	})
}, 5000)
Log.Green(`[Startup]: On-Load Processes started!`)
