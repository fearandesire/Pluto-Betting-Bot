import { ApplyOptions } from '@sapphire/decorators'
import { Command } from '@sapphire/framework'
import { infoEmbed } from '../../lib/discord/builders/info.js'
import PlutoInfo from '../../utils/commands/info/info.js'

@ApplyOptions<Command.Options>({
	description: '❓ How to use Pluto',
})
export class UserCommand extends Command {
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand(
			(builder) =>
				builder //
					.setName(this.name)
					.setDescription(this.description),
			{
				idHints: ['1095834036175372418'],
			},
		)
	}

	public override async chatInputRun(
		interaction: Command.ChatInputCommandInteraction,
	) {
		const helpInfo = await PlutoInfo.helpInfo()
		const embed = infoEmbed(helpInfo)

		return interaction.reply({
			embeds: [embed],
			ephemeral: true,
		})
	}
}
