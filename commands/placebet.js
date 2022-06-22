import { CmdRunning } from '../utils/bot_res/classes/RunCmd.js'
import { Command } from '@sapphire/framework'
import { ConfirmBet } from '../utils/cmd_res/confirmBet.js'
import { Log } from '../utils/bot_res/send_functions/consoleLog.js'
import { embedReply } from '../utils/bot_res/send_functions/embedReply.js'
import { isMatchExist } from '../utils/cmd_res/isMatchExist.js'

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
		new CmdRunning(this.name) //? Log command running
		//* Gather user input
		var inputAmount = await args.pick('number').catch(() => null) //? Amount user wants to bet
		//? The 'teamID' is the identifier for the 'team' the user wants to bet on
		var inputTeamID = await args.pick('string').catch(() => null) //! A list will be in place (gatherodds embed) with assosciated team IDs, and we will need to possibly setup flags to stop invalid teamID input
		var user = message.author.id //? user id
		await Log.Yellow(
			`[${this.name}.js] User ${message.author.username} (${message.author.id}) is getting a bet ready!`, //? Debug purposes, this will likely be removed later. For now, it's intended to confirm the user's input
		)
		await Log.Blue(`Bet Slip:\nAmount: ${inputAmount}\nTeamID: ${inputTeamID}`)
		//* Verify team / match user is betting on exists, otherwise return error message
		if (await isMatchExist(inputTeamID)) {
			//? 'betslip' - object containing the user's bet information
			var betslip = {}
			betslip.userid = user
			betslip.amount = inputAmount
			betslip.teamid = inputTeamID
			Log.Yellow(JSON.stringify(betslip)) //? Debug purposes, this will likely be removed later. For now, it's intended to confirm the user's input
			//? For now, adding an option for the user to confirm their bet before it is placed.
			ConfirmBet(message, betslip, args)
			//* Otherwise, return error message as the team was not found in the database
		} else {
			var embedcontent = {
				title: 'Betting Error',
				description: `The team you entered (${inputTeamID}) is invalid. Please review the list of active matchups`,
				color: '#ff0000',
			}
			embedReply(message, embedcontent)
			//message.reply(`The match you are betting on does not exist.`)
			return
		}
	}
}
