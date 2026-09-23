import { ApplyOptions } from '@sapphire/decorators'
import { Command } from '@sapphire/framework'
import embedColors from '../../lib/colorsConfig.js'
import { infoEmbed } from '../../lib/discord/builders/info.js'
import { PatreonInformation } from '../../utils/api/patreon/interfaces.js'

@ApplyOptions<Command.Options>({
	description: '💙 Support new features & development of Pluto',
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
		await interaction.deferReply({ ephemeral: true })
		const emb = infoEmbed({
			title: 'Supporting Development | Patreon 💙',
			description: PatreonInformation,
			color: embedColors.PlutoBlue,
			footer: 'For questions, message me on Discord: fenixforever',
			thumbnail: 'https://i.imgur.com/qG3Mm5t.png',
		})

		return interaction.editReply({ embeds: [emb] })
	}
}
