import { Command } from '@sapphire/framework'
import { embedReply } from '#config'
import { loadJsonFile } from 'load-json-file'
export class about extends Command {
    constructor(context, options) {
        super(context, {
            ...options,
            name: 'about',
            aliases: [''],
            description: 'Information about Pluto',
            chatInputCommand: {
                register: true,
            },
        })
    }

    registerApplicationCommands(registry) {
        registry.registerChatInputCommand(
            (builder) =>
                builder //
                    .setName('about')
                    .setDescription(this.description),
            //    { idHints: [`1022940422974226432`] },
        )
    }
    async chatInputRun(interaction) {
        var pkg = await loadJsonFile('./package.json')
        var invisIndent = ` ‎ ‎ ‎ ‎ ‎ ‎ ‎ ‎ ‎ ‎ `
        var embObj = {
            title: 'About Pluto',
            description: `
            
Pluto is a full-fledged betting bot with a strong focus on simplicity. You can securely place bets on NFL & NBA games and participate in the online betting scene without using real-life currency.

${invisIndent} **:robot: __Pluto Features:__**
${invisIndent} ◦ **H2H Wagers**
${invisIndent} __◊ Automatic & Autonomous:__
${invisIndent} ◦ **Real-Time Bet processing**
${invisIndent} ◦ **Real-Time Game Channel scheduling, and deletion**
${invisIndent} ━━
${invisIndent} :heart: **Enjoy using Pluto? [Support development & server cost](https://ko-fi.com/fenix7559)**
${invisIndent} :nerd: [GitHub](https://github.com/fearandesire/Pluto-Betting-Bot/blob/main/README.md)
${invisIndent} :question: For questions/concerns, contact me @: **<@${process.env.botDevID}>**
            `,
            color: `#68d6e6`,
            thumbnail: `https://i.imgur.com/RWjfjyv.png`,
            footer: `© FENIX 2022 | Version: ${pkg.version}`,
            target: `reply`,
            silent: true,
        }
        await embedReply(interaction, embObj)
    }
}
