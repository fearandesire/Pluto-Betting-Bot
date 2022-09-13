import { resolveTeam } from '#cmdUtil/resolveTeam'
import { Command } from '@sapphire/framework'
import async from 'async'
import _ from 'lodash'
import { FileRunning } from '../utils/bot_res/classes/FileRunning.js'
import { Log } from '../utils/bot_res/send_functions/consoleLog.js'
import { QuickError } from '../utils/bot_res/send_functions/embedReply.js'
import { resovleMatchup } from '../utils/cache/resolveMatchup.js'
import { insufficientFunds } from '../utils/cmd_res/insufficientFunds.js'
import { processTrans } from '../utils/cmd_res/processTrans.js'
import { setupBet } from '../utils/cmd_res/setupBet.js'
import { validateUser } from '../utils/cmd_res/validateExistingUser.js'
import { verifyDupBet } from '../utils/cmd_res/verifyDuplicateBet.js'
import { gameActive } from '../utils/date/gameActive.js'

export class placebet extends Command {
	constructor(context, options) {
		super(context, {
			...options,
			name: 'placebet',
			aliases: ['bet', 'pbet'],
			description: 'Place Bet (test',
		})
	}

	async messageRun(message, args) {
		new FileRunning(this.name) //? Log command running
		var betAmount = await args.pick('number').catch(() => null)
		var betOnTeam = await args.rest('string').catch(() => null)
		if (!betOnTeam) {
			//# null input
			QuickError(message, 'Please enter a team or match id')
			return
		}
		betOnTeam = await resolveTeam(betOnTeam)
		if (!betOnTeam) {
			//# failure to match team
			QuickError(message, 'Please enter a valid team or match id')
			return
		}
		if (!betAmount || !_.isNumber(betAmount) || betAmount < 1) {
			QuickError(message, `Please provide a valid amount to bet.`)
			return
		}
		if (betAmount.toString().includes('.')) {
			QuickError(message, `Please provide a whole number to bet with.`)
			return
		}
		var user = message.author.id //? user id
		var matchInfo = await resovleMatchup(betOnTeam)
		var matchupId = parseInt(matchInfo.matchupId)
		var activeCheck = await gameActive(betOnTeam)
		if (activeCheck === true) {
			QuickError(
				message,
				`This match has already started, you are unable to place a bet on active games.`,
			)
			return
		}
		await Log.Yellow(
			`[${this.name}.js] User ${message.author.username} (${message.author.id}) is getting a bet ready!`, //? Debug purposes, this will likely be removed later. For now, it's intended to confirm the user's input
		)
		await Log.Blue(`Bet Slip:\nAmount: ${betAmount}\nTeam: ${betOnTeam}`)
		async.series(
			[
				async function valUser() {
					await validateUser(message, user)
					return
				},
				async function verDup() {
					await verifyDupBet(message, user, matchupId)
					return
				},
				async function insufFunds() {
					var checkFunds = await insufficientFunds(message, user)
					if (!checkFunds) {
						QuickError(
							message,
							`Unable to locate any balance for your account in the database.`,
						)
						throw new Error(
							`User ${message.author.username} (${message.author.id}) does not have sufficient funds to place their bet. [Unable to locate any balance for your account in the database]`,
						)
					}
					return
				},
				async function procTran(insufFunds) {
					await processTrans(message, user, insufFunds, betAmount, betOnTeam)
					return
				},
				async function setBet() {
					await setupBet(message, betOnTeam, betAmount)
					return
				},
			],
			function (err) {
				if (err) {
					Log.Red(err)
					return
				}
			},
		)
	}
}
