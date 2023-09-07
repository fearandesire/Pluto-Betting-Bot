import discord from 'discord.js'
import _ from 'lodash'

const { EmbedBuilder } = discord
export const alloddsembed = function (
	message,
	Team1,
	Team1Odds,
	Team2,
	Team2Odds,
) {
	const sport = _.upperCase(process.env.SPORT)
	const PlutoPlainEmbed = new EmbedBuilder()
		.setTitle(`${title} H2H Betting Odds`)
		.setColor('#FFFF00')
		.addFields(
			{
				name: `**${Team1}**`,
				value: `Odds: **${Team1Odds}**`,
				inline: false,
			},
			{
				name: `**${Team2}**`,
				value: `Odds: **${Team2Odds}**`,
				inline: false,
			},
		)
	message.reply({ embeds: [PlutoPlainEmbed] })
}
