import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { EmbedBuilder } from 'discord.js';
import embedColors from '../../lib/colorsConfig.js';
import { PatreonInformation } from '../../utils/api/patreon/interfaces.js';

@ApplyOptions<Command.Options>({
	description: '💙 Support new features & development of Pluto',
})
export class UserCommand extends Command {
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder //
				.setName(this.name)
				.setDescription(this.description),
		);
	}

	public override async chatInputRun(
		interaction: Command.ChatInputCommandInteraction,
	) {
		await interaction.deferReply({ ephemeral: true });
		const blue = embedColors.PlutoBlue;
		const thumbnail = 'https://i.imgur.com/qG3Mm5t.png';
		const emb = new EmbedBuilder()

			.setTitle('Supporting Development | Patreon 💙')
			.setDescription(PatreonInformation)
			.setColor(blue)
			.setFooter({
				text: 'For questions, message me on Discord: fenixforever',
			})
			.setThumbnail(thumbnail);

		return interaction.editReply({ embeds: [emb] });
	}
}
