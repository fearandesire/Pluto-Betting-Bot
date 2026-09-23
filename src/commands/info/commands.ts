import { ApplyOptions } from '@sapphire/decorators'
import { Command } from '@sapphire/framework'
import { plutoDocsUrl } from '../../lib/configs/constants.js'
import { infoEmbed } from '../../lib/discord/builders/info.js'
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
		const embed = infoEmbed({ ...commandsInfo, url: `${plutoDocsUrl}` })

		return interaction.reply({
			embeds: [embed],
			ephemeral: true,
		})
	}
}
