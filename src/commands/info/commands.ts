import { ApplyOptions } from '@sapphire/decorators'
import { Command } from '@sapphire/framework'
import _ from 'lodash'
import embedColors from '../../lib/colorsConfig.js'
import { EmbedBuilder } from 'discord.js'
import { helpfooter } from '@pluto-core-config'

@ApplyOptions<Command.Options>({
	description: '❓ View all commands available to use',
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
		const cmdList: { [key: string]: { [key: string]: string } } = {
			betting: {
				odds: "View the odds for this week's matches",
				bet: 'Place a bet on a matchup',
				cancelbet: "Cancel a pending bet you've placed",
				balance: 'View your current balance',
			},
			info: {
				stats: 'View your betting stats',
				leaderboard:
					"View the betting leaderboard, see who's on top and where you stand!",
				help: 'View information on how to use the bot',
				commands: 'View all commands available to you',
				bethistory: 'View the track record of your bets',
			},
		}

		const formatCommands = (cmds: {
			[key: string]: { [key: string]: string }
		}) => {
			let formattedCommands = ''
			for (const [key, value] of Object.entries(cmds)) {
				formattedCommands += `⭐ **__${_.upperFirst(key)}__**\n`
				for (const [command, description] of Object.entries(value)) {
					formattedCommands += `**\`/${command}\`** - ${description}\n`
				}
				formattedCommands += '\n'
			}
			return formattedCommands
		}
		const cmdDescription = formatCommands(cmdList)
		const cmdListEmbed = new EmbedBuilder()
			.setTitle('Commands')
			.setColor(embedColors.PlutoYellow)
			.setDescription(
				`${cmdDescription}\n*Currently, the following commands are under maintenance
			- \`bethistory\`
			- \`stats\`
			- \`leaderboard\`
			.*`,
			)
			.setFooter({
				text: helpfooter,
			})
			.setThumbnail(`https://i.imgur.com/RWjfjyv.png`)

		return interaction.reply({
			embeds: [cmdListEmbed],
			ephemeral: true,
		})
	}
}
