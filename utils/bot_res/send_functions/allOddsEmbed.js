import { MessageEmbed } from 'discord.js'

export const alloddsembed = function (
    message,
    Team1,
    Team1Odds,
    Team2,
    Team2Odds,
) {
    const PlutoPlainEmbed = new MessageEmbed()
        .setTitle('NBA H2H Betting Odds')
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
    return message.reply({ embeds: [PlutoPlainEmbed] })
}
