import { ApplyOptions } from '@sapphire/decorators'
import { Command } from '@sapphire/framework'
import { loadJsonFile } from 'load-json-file'
import { EmbedBuilder } from 'discord.js'
import embedColors from '../../lib/colorsConfig.js'

@ApplyOptions<Command.Options>({
	description: '❓ Learn about Pluto',
})
export class UserCommand extends Command {
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder //
				.setName(this.name)
				.setDescription(this.description),
		)
	}

	public override async chatInputRun(
		interaction: Command.ChatInputCommandInteraction,
	) {
		const pkg = (await loadJsonFile('./package.json')) as {
			version: string
		}
		const projVersion = pkg.version
		const embObj = {
			title: 'About Pluto',
			description: `
Pluto is a full-fledged betting bot with a strong focus on simplicity. You can securely place bets on NFL & NBA games and participate in the online betting scene without using real-life currency.
# :robot: __Pluto Features:__
◦ **H2H Wagers**
◦ **Real-Time Bet processing**
◦ **Real-Time Game Channel scheduling and deletion**
━━━━━━━━
Pluto uses virtual currency with real match odds from various bookmakers to simulate common popular betting sites & the real betting experience.
**For usage, please refer to the /help command!**
:heart: **Enjoy using Pluto? [Support development & server cost](https://ko-fi.com/fenix7559)**
:nerd: [GitHub](https://github.com/fearandesire/Pluto-Betting-Bot)
:question: For questions/concerns, contact me: **<@${process.env.botDevID}>**
            `,
			color: `#68d6e6`,
			thumbnail: `https://i.imgur.com/RWjfjyv.png`,
			footer: `© fenixforever 2024 | Version: ${projVersion}`,
			target: `reply`,
		}
		const embed = new EmbedBuilder()
			.setTitle(embObj.title)
			.setDescription(embObj.description)
			.setColor(embedColors.PlutoBlue)
			.setThumbnail(embObj.thumbnail)
			.setFooter({
				text: embObj.footer,
			})

		return interaction.reply({
			embeds: [embed],
			ephemeral: true,
		})
	}
}
