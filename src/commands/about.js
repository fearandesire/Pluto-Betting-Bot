import { Command } from '@sapphire/framework'
import { loadJsonFile } from 'load-json-file'
import { embedReply } from '@pluto-core-config'

export class about extends Command {
	constructor(context, options) {
		super(context, {
			...options,
			name: 'about',
			aliases: [''],
			description: '❓ Information about Pluto',
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
					.setDescription(this.description)
					.setDMPermission(false),
			//    { idHints: [`1022940422974226432`] },
		)
	}

	async chatInputRun(interaction) {
		const pkg = await loadJsonFile('./package.json')
		const invisIndent = ` ‎ ‎ ‎ ‎ ‎ ‎ ‎ ‎ ‎ ‎ `
		const embObj = {
			title: 'About Pluto',
			description: `
            
Pluto is a full-fledged betting bot with a strong focus on simplicity. You can securely place bets on NFL & NBA games and participate in the online betting scene without using real-life currency.

${invisIndent} **:robot: __Pluto Features:__**
${invisIndent} ◦ **H2H Wagers**
${invisIndent} ◊ Automatic & Autonomous:
${invisIndent} ◦ **Real-Time Bet processing**
${invisIndent} ◦ **Real-Time Game Channel scheduling and deletion**
${invisIndent} ━━
${invisIndent} Pluto uses virtual currency to simulate a real-life betting
${invisIndent} **For usage, please refer to the /help command!**
${invisIndent} :heart: **Enjoy using Pluto? [Support development & server cost](https://ko-fi.com/fenix7559)**
${invisIndent} :nerd: [GitHub](https://github.com/fearandesire/Pluto-Betting-Bot)
${invisIndent} :question: For questions/concerns, contact me: **<@${process.env.botDevID}>**
            `,
			color: `#68d6e6`,
			thumbnail: `https://i.imgur.com/RWjfjyv.png`,
			footer: `© fenixforever 2023 | Version: ${pkg.version}`,
			target: `reply`,
			silent: true,
		}
		await embedReply(interaction, embObj)
	}
}
