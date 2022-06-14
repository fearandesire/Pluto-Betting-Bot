import {
    MessageEmbed
} from "discord.js";
import {
    NBACLogo
} from "../lib/PlutoConfig.js";
import {
    LogBorder,
    LogGreen,
    LogYellow
} from "./ConsoleLogging.js";

export function SendMatchupList(message, MatchupList) {
    var embedFooter = 'Provided by Pluto';
    LogYellow("[SendMatchupList.js] Compiling Matchup List Embed");
    LogBorder();

    //? May use a map later on for formatting
    // // const PlutoPlainEmbed = new MessageEmbed()
    // //   .setTitle("NBA H2H Betting Odds")
    // //   .setColor("#FFFF00")
    // //   .addFields(
    // //   MatchupList.map((item, index) => {
    // //   })
    const MatchupListEmbed = new MessageEmbed()

        .setTitle("Today's NBA H2H Betting Odds")
        .setColor("#FFFF00")
        .setDescription(MatchupList.join('\n \n'))
        .setTimestamp()
        .setThumbnail(
            NBACLogo
        )
        .setFooter({text:embedFooter});
    message.reply({
        embeds: [MatchupListEmbed]
    })

    LogGreen(`[SendMatchupList.js] Sent Matchup List Embed`);
    LogBorder();

    return;

}