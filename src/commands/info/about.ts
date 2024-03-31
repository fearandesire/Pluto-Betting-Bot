import { ApplyOptions } from '@sapphire/decorators'
import { Command } from '@sapphire/framework'
import { EmbedBuilder } from 'discord.js'
import PlutoInfo from '../../utils/commands/info/info.js'

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
		const aboutInfo = PlutoInfo.aboutInfo()
		const embed = new EmbedBuilder()
			.setTitle(aboutInfo.title)
			.setDescription(aboutInfo.description)
			.setColor(aboutInfo.color)
			.setThumbnail(aboutInfo.thumbnail)
			.setFooter({
				text: aboutInfo.footer,
			})

		return interaction.reply({
			embeds: [embed],
			ephemeral: true,
		})
	}
}
