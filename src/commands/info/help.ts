import { ApplyOptions } from '@sapphire/decorators'
import { Command } from '@sapphire/framework'
import { EmbedBuilder } from 'discord.js'
import PlutoInfo from '../../utils/commands/info/info.js'

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
		const helpInfo = PlutoInfo.helpInfo()
		const embed = new EmbedBuilder()
			.setTitle(helpInfo.title)
			.setDescription(helpInfo.description)
			.setColor(helpInfo.color)
			.setThumbnail(helpInfo.thumbnail)
			.setFooter({
				text: helpInfo.footer,
			})

		return interaction.reply({
			embeds: [embed],
			ephemeral: true,
		})
	}
}
