import { ApplyOptions } from '@sapphire/decorators'
import { Command } from '@sapphire/framework'
import { InteractionContextType, MessageFlags } from 'discord.js'
import { ParlayBuilderService } from '../../services/ParlayBuilderService.js'
import { ErrorEmbeds } from '../../utils/common/errors/global.js'

@ApplyOptions<Command.Options>({
	description: '🎲 Build a multi-game parlay',
})
export class UserCommand extends Command {
	private builderService?: ParlayBuilderService

	private getService(): ParlayBuilderService {
		return (this.builderService ??= new ParlayBuilderService())
	}

	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder
				.setName(this.name)
				.setDescription(this.description)
				.setContexts(InteractionContextType.Guild),
		)
	}

	public override async chatInputRun(
		interaction: Command.ChatInputCommandInteraction,
	) {
		await interaction.deferReply({ flags: MessageFlags.Ephemeral })
		try {
			const service = this.getService()
			const session = await service.start(
				interaction.user.id,
				interaction.guildId!,
			)
			return interaction.editReply(service.render(session))
		} catch (error) {
			this.container.logger.error({
				message: 'Failed to start parlay builder',
				metadata: {
					userId: interaction.user.id,
					error:
						error instanceof Error ? error.message : String(error),
				},
			})
			return interaction.editReply({
				embeds: [
					await ErrorEmbeds.internalErr(
						'Unable to start your parlay. Please try again.',
					),
				],
			})
		}
	}
}
