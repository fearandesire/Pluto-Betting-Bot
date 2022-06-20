import { AssignBetID } from '../bot_res/AssignIDs.js'
import { Log } from '../bot_res/send_functions/consoleLog.js'
import { confirmBetEmbed } from '../bot_res/send_functions/confirmBetEmbed.js'

/**
	 * @ConfirmedBet - a function to determine if the user will confirm their bet, or not via message collection on a 60 second timer. 
	@obj betoptions: { 𝗮𝗺𝗼𝘂𝗻𝘁: ⁡⁣⁣⁢100⁡, 𝘁𝗲𝗮𝗺𝗜𝗗: ⁡⁣⁣⁢𝘯⁡, 𝗺𝗮𝘁𝗰𝗵𝗜𝗗: ⁡⁣⁣⁢𝙣⁡ } - the options for the bet to be placed, prior gathered from the user's input [placedbet.js]
	 
     */
export async function ConfirmBet(message, betoptions) {
	//await message.reply(`Please confirm your bet:`)
	await confirmBetEmbed(message, betoptions)
	//?  Listen to message using awaitMessages and confirm bet from user
	const filter = (m) => m.author.id === message.author.id
	Log.Yellow(`[confirmBet.js] Started timer!`)
	const collector = message.channel.createMessageCollector(filter, {
		time: 60000,
		error: 'timeout',
	})
	collector.on('collect', async (m) => {
		if (m.content.toLowerCase() === 'yes') {
			collector.stop()
			await message.reply('Bet Placed!')
			var setBetID = AssignBetID()
			betoptions['betID'] = setBetID
			Log.Green(
				`[confirmBet.js] Bet Placed!\n Bet Slip:\n ${JSON.stringify(
					betoptions,
				)}`,
			)
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
	var timeout = setTimeout(() => {
		collector.stop('time')
	}, 60000)
}
