import { NBACLogo, embedfooter } from '../../../lib/PlutoConfig.js'

import { Log } from './consoleLog.js'
import { MessageEmbed } from 'discord.js'

export function SendMatchupList(message, MatchupList) {
    Log.Yellow('[SendMatchupList.js] Compiling Matchup List Embed')
    Log.Border()

    const MatchupListEmbed = new MessageEmbed()

        .setTitle("Today's NBA H2H Betting Odds")
        .setColor('#FFFF00')
        .setDescription(MatchupList.join('\n \n'))
        .setTimestamp()
        .setThumbnail(NBACLogo)
        .setFooter({ text: embedfooter })
    message.reply({
        embeds: [MatchupListEmbed],
    })

    Log.Green(`[SendMatchupList.js] Sent Matchup List Embed`)
    Log.Border()

    return
}
