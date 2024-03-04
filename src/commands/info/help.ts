import { ApplyOptions } from '@sapphire/decorators'
import { Command } from '@sapphire/framework'
import embedColors from '../../lib/colorsConfig.js'
import { EmbedBuilder } from 'discord.js'
import { helpfooter } from '@pluto-core-config'

@ApplyOptions<Command.Options>({
	description: '❓ How to use Pluto',
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
		const desc = `Pluto provides the fun of placing wagers on sports games, featuring leaderboards and statistics to compete against others.\n# Getting Started\nTo get started, first run the slash command \`/odds\` and view the current odds available. You can immediately start placing bets with the \`/bet\` command. You'll start with a balance of $50 to bet with.\nUse the command \`/dailyclaim\` every 24 hours to receive free money into your account - this is useful if you ran out of money. Don't give up!\n# Process\nOnce a game ends, the bets placed on it will be processed.\nYou'll receive a DM from Pluto with your winnings and relevant bet result information.\nUse /commands to view all commands available\n***💜 Want to support the development of Pluto? Use the /about command***`
		const helpEmbed = new EmbedBuilder()
			.setTitle(`How to use Pluto :coin:`)
			.setColor(embedColors.PlutoYellow)
			.setDescription(desc)
			.setThumbnail(`https://i.imgur.com/RWjfjyv.png`)
			.setFooter({
				text: helpfooter,
			})
		return interaction.reply({
			embeds: [helpEmbed],
			ephemeral: true,
		})
	}
}
