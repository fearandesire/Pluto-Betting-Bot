import { ApplyOptions } from '@sapphire/decorators'
import { Command } from '@sapphire/framework'
import { EmbedBuilder } from 'discord.js'
import { plutoDocsUrl } from '../../lib/configs/constants.js'
import PlutoInfo from '../../utils/commands/info/info.js'

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
		const commandsInfo = await PlutoInfo.commandsInfo()
		const embed = new EmbedBuilder()
			.setTitle(commandsInfo.title)
			.setDescription(commandsInfo.description)
			.setColor(commandsInfo.color)
			.setThumbnail(commandsInfo.thumbnail)
			.setFooter({
				text: commandsInfo.footer,
			})
			.setURL(`${plutoDocsUrl}`)

		return interaction.reply({
			embeds: [embed],
			ephemeral: true,
		})
	}
}
