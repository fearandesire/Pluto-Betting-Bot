import { MessageEmbed } from 'discord.js'
import _ from 'lodash'

export const alloddsembed = function (
    message,
    Team1,
    Team1Odds,
    Team2,
    Team2Odds,
) {
    const sportname = _.upperCase(process.env.sportsname)
    const PlutoPlainEmbed = new MessageEmbed()
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
    return
}
