import { ApplyOptions } from '@sapphire/decorators'
import { Command } from '@sapphire/framework'
import { InteractionContextType } from 'discord.js'
import { isApiError } from './../../lib/interfaces/errors/api-errors.js'
import env from '../../lib/startup/env.js'
import { runDoubleDown } from '../../utils/api/Khronos/bets/doubledown-flow.js'
import PatreonFacade from '../../utils/api/patreon/Patreon-Facade.js'
import { ErrorEmbeds } from '../../utils/common/errors/global.js'

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

		if (env.MAINTENANCE_MODE) {
			const errEmbed = await ErrorEmbeds.maintenanceMode()
			return interaction.editReply({ embeds: [errEmbed] })
		}

		// Ensure user is Patreon member
		const isMember = await PatreonFacade.memberDetails(interaction.user.id)
		if (!isMember || isApiError(isMember)) {
			const errEmbed = await ErrorEmbeds.patreonMembersOnly()
			await interaction.editReply({
				embeds: [errEmbed],
			})
			return
		}
		const betId = interaction.options.getInteger('betid', true)
		return runDoubleDown(interaction, betId)
	}
}
