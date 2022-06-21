import { MessageEmbed } from 'discord.js'

//? Return users input from bet placement in an embed response for them to confirm. See: utils\cmd_res\confirmBet.js
export function confirmBetEmbed(message, betslip) {
	var customerFooter = 'PLEASE NOTE: YOUR BET IS NOT CONFIRMED YET!'
	const confirmembed = new MessageEmbed()
		.setColor('#0099ff')
		.setTitle('Bet Slip Confirmation')
		.setDescription(
			`Below, you will find your bet slip. Please confirm your bet slip by typing **yes** or **no**`,
		)
		.addFields(
			{
				name: `Amount: `,
				value: `${betslip.betdata[0].amount}`,
				inline: true,
			},
			{
				name: `Team: `,
				value: `${betslip.betdata[0].teamID}`,
				inline: true,
			},
			{
				name: `Match: `,
				value: `${betslip.betdata[0].matchID}`,
				inline: true,
			},
		)
		.setTimestamp()
		.setFooter({ text: customerFooter })

	return message.reply({ embeds: [confirmembed] })
}
