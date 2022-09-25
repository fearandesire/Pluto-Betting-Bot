import 'dotenv/config'

import { Log, QuickError } from '#config'

import { Command } from '@sapphire/framework'
import { returnOddsFor } from '#cacheUtil/returnOddsFor'

export class oddsfor extends Command {
	constructor(context, options) {
		super(context, {
			...options,
			name: 'oddsfor',
			aliases: ['oddsfor'],
			description: 'Returns odds for specified team',
		})
	}

	async messageRun(message, args) {
		Log.Yellow(`[oddsfor.js] Running oddsfor.js!`)
		var team = await args.rest('string').catch(() => null)
		if (!team) {
			QuickError(message, 'Please enter a team to view the odds for')
			return
		}
		await returnOddsFor(message, team)
	}
}
