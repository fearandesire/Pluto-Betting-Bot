import { AssignBetID } from '../bot_res/AssignIDs.js'
import { Log } from '../bot_res/send_functions/consoleLog.js'
import { addNewBet } from './addNewBet.js'
import { embedReply } from '../bot_res/send_functions/embedReply.js'
import { confirmBetEmbed as pleaseConfirmEmbed } from '../bot_res/send_functions/confirmBetEmbed.js'

/**
	 * @ConfirmedBet - a function to determine if the user will confirm their bet, or not via message collection on a 60 second timer. 
	@obj betslip: { 𝗮𝗺𝗼𝘂𝗻𝘁: ⁡⁣⁣⁢100⁡, 𝘁𝗲𝗮𝗺𝗜𝗗: ⁡⁣⁣⁢𝘯⁡, 𝗺𝗮𝘁𝗰𝗵𝗜𝗗: ⁡⁣⁣⁢𝙣⁡ } - the options for the bet to be placed, prior gathered from the user's input [placedbet.js]
	 
     */
export async function ConfirmBet(message, betslip) {
	//? Sending Embed of bet slip to user to confirm bet
	await pleaseConfirmEmbed(message, betslip)
	//?  Listen for the user to confirm their bet via message collection [Discord.js] on a 60 second timer.
	const filter = (m) => m.author.id === message.author.id
	Log.Yellow(`[confirmBet.js] Started timer!`)
	const collector = message.channel.createMessageCollector(filter, {
		time: 60000,
		error: 'time',
	})
	collector.on('collect', async (m) => {
		if (m.content.toLowerCase() === 'yes') {
			collector.stop()
			var setBetID = AssignBetID()
			betslip.betid = setBetID
			Log.Green(
				`[confirmBet.js] ${
					betslip.userid
				} confirmed a bet!\n Bet Slip:\n ${JSON.stringify(betslip)}`,
			)
			addNewBet(betslip) //? Add bet to active bet list in DB
			//? Passing confirmation message into an embed with the following embed content:
			var embedcontent = {
				title: 'Bet Slip Confirmed',
				description:
					'Congratulations! Your bet has been placed! You may view your active bets with the `?betslips` (W.I.P) command.',
				color: '#00FF00',
			}
			await embedReply(message, embedcontent)
			return
		}
		if (m.content.toLowerCase() === 'no') {
			collector.stop()
			await message.reply('Bet Cancelled!')
			return
		}
	})
	collector.on('end', (collected, reason) => {
		if (reason === 'time') {
			message.reply(
				'Bet Cancelled! You did not confirm your bet in time [60 seconds].',
			)
		}
	})
	//? 60 Second Timer to confirm bet
	setTimeout(() => {
		collector.stop('time')
	}, 60000)
}
