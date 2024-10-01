import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { PermissionFlagsBits } from 'discord.js';
import PropsApiWrapper from '../../utils/api/Khronos/props/propsApiWrapper.js';

@ApplyOptions<Command.Options>({
	description: 'Generate all prop embeds',
})
export class UserCommand extends Command {
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand(
			(builder) =>
				builder //
					.setName(this.name)
					.setDescription(this.description)
					.setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),
			{
				idHints: ['1288178546942021643', '1290465537859784745'],
				guildIds: ['777353407383339038'],
			},
		);
	}

	public override async chatInputRun(
		interaction: Command.ChatInputCommandInteraction,
	) {
		await new PropsApiWrapper().generateAllPropEmbeds();
		return interaction.reply({
			content: 'Prop Embeds populated successfully',
		});
	}
}
