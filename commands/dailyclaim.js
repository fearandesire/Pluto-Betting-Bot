import { processClaim } from '#utilDB/processClaim'
import { Command } from '@sapphire/framework'

export class dailyclaim extends Command {
	constructor(context, options) {
		super(context, {
			...options,
			name: 'dailyclaim',
			aliases: ['claim', 'dc'],
			description: 'Daily Claim',
		})
	}

	async messageRun(message) {
		const userid = message.author.id
		var currentTime = new Date().getTime()
		processClaim(userid, message, currentTime)
	}
}
