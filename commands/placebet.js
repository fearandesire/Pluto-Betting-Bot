import { CmdRunning } from '../utils/bot_res/RunCmd.js'
import { Command } from '@sapphire/framework'
import { ConfirmBet } from '../utils/cmd_res/confirmBet.js'
import { Log } from '../utils/bot_res/send_functions/consoleLog.js'

export class placebet extends Command {
	constructor(context, options) {
		super(context, {
			...options,
			name: 'placebet',
			aliases: ['bet', 'pbet'],
			description: 'Place Bet (test',
			requiredUserPermissions: ['KICK_MEMBERS'],
		})
	}

	async messageRun(message, args) {
		//? Log command running
		var initialLog = new CmdRunning(this.name)
		//? Amount user wants to bet
		var inputAmount = await args.pick('number').catch(() => null)
		//? The 'teamID' is the identifier for the 'team' the user wants to bet on
		//! A list will be in place (gatherodds embed) with assosciated team IDs, and we will need to possibly setup flags to stop invalid teamID input
		var inputTeamID = await args.pick('number').catch(() => null)
		//? The 'matchID' is the identifier for the 'match' the user wants to bet on (also will be listed with the gatherodds embed-like cmd)
		var inputMatchID = await args.pick('number').catch(() => null)
		//? Debug purposes, this will likely be removed later. For now, it's intended to confirm the user's input
		await Log.Yellow(
			`[${this.name}.js] User ${message.author.username} (${message.author.id}) is getting a bet ready!`,
		)
		await Log.Blue(
			`Bet Slip:\nAmount: ${inputAmount}\nTeamID: ${inputTeamID}\nMatchID: ${inputMatchID}`,
		)
		const placedbetoptions = {
			amount: inputAmount,
			teamID: inputTeamID,
			matchID: inputMatchID,
		}
		//? For now, adding an option for the user to confirm their bet before it is placed.
		ConfirmBet(message, placedbetoptions, args)
	}
}
