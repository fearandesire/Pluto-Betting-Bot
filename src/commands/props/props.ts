import { ApplyOptions } from '@sapphire/decorators'
import { Command } from '@sapphire/framework'
import PropsApiWrapper from '@utils/api/Khronos/props/propsApiWrapper.js'

@ApplyOptions<Command.Options>({
	description: 'A basic slash command',
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
		await new PropsApiWrapper().generateAllPropEmbeds()
		return interaction.reply({
			content: 'Prop Embeds populated successfully',
		})
	}
}
