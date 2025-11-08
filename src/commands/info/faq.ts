import { ApplyOptions } from '@sapphire/decorators'
import { Command } from '@sapphire/framework'
import { EmbedBuilder } from 'discord.js'
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
		const embed = new EmbedBuilder()
			.setTitle(faqInfo.title)
			.setDescription(faqInfo.description)
			.setColor(faqInfo.color)
			.setThumbnail(faqInfo.thumbnail)
			.setFooter({
				text: faqInfo.footer,
			})

		return interaction.reply({ embeds: [embed], ephemeral: true })
	}
}
