//? cmd for quick testing of functions

import { Command } from '@sapphire/framework'
import { QuickError } from '#config'

//import { sortCancelBet } from '#utilBetOps/sortCancelBet.js'

export class closeBet extends Command {
	constructor(context, options) {
		super(context, {
			...options,
			name: 'closeBet',
			aliases: [''],
			description:
				'Close a matchup via the match ID, payout the winners & update the database accordingly.',
		})
	}
	async messageRun(message, args) {
		let matchId = await args.pick('number').catch(() => null)
		let teamThatWon = await args.rest('string').catch(() => null)
		if (!matchId || !teamThatWon) {
			QuickError(message, `Please provide a match ID and the team that won.`)
			return
		}
	}
}
