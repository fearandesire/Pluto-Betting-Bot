import { ApplyOptions } from '@sapphire/decorators'
import { Command } from '@sapphire/framework'
import { InteractionContextType } from 'discord.js'
import { sendPredictionCommandDeprecation } from '../../utils/commands/prediction-deprecation.js'

/**
 * @deprecated Use /predictions history. Kept for one release as a pointer.
 */
@ApplyOptions<Command.Options>({
	description: 'View your prediction history (legacy alias)',
})
export class UserCommand extends Command {
	public override registerApplicationCommands(registry: Command.Registry) {
		// No id hint: the former history hint was shared with /prediction.
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
		return sendPredictionCommandDeprecation(
			interaction,
			'/predictions history',
		)
	}
}
