import { ApplyOptions } from '@sapphire/decorators'
import { Command } from '@sapphire/framework'
import { InteractionContextType } from 'discord.js'
import {
	doubleDownGateError,
	runDoubleDown,
} from '../../utils/api/Khronos/bets/doubledown-flow.js'

@ApplyOptions<Command.Options>({
	description: 'Double down an existing bet',
})
export class UserCommand extends Command {
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand(
			(builder) =>
				builder //
					.setName(this.name)
					.setDescription(this.description)
					.setContexts(InteractionContextType.Guild)
					.addIntegerOption((option) =>
						option
							.setName('betid')
							.setDescription('The ID of the bet to double down')
							.setRequired(true),
					),
			{
				idHints: ['1233093568067932251'],
			},
		)
	}

	public override async chatInputRun(
		interaction: Command.ChatInputCommandInteraction,
	) {
		await interaction.deferReply({ ephemeral: true })

		const blocked = await doubleDownGateError(interaction.user.id)
		if (blocked) return interaction.editReply({ embeds: [blocked] })
		const betId = interaction.options.getInteger('betid', true)
		return runDoubleDown(interaction, betId)
	}
}
