import { ApplyOptions } from '@sapphire/decorators'
import { Command } from '@sapphire/framework'
import { infoEmbed } from '../../lib/discord/builders/info.js'
import PlutoInfo from '../../utils/commands/info/info.js'

@ApplyOptions<Command.Options>({
	description: '❓ Frequently Asked Questions & XP System',
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
		const faqInfo = await PlutoInfo.faqInfo()
		const embed = infoEmbed(faqInfo)

		return interaction.reply({ embeds: [embed], ephemeral: true })
	}
}
