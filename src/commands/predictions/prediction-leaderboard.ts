import { ApplyOptions } from '@sapphire/decorators'
import { Command } from '@sapphire/framework'
import { InteractionContextType } from 'discord.js'
import { sendPredictionCommandDeprecation } from '../../utils/commands/prediction-deprecation.js'

/**
 * @deprecated Use /predictions leaderboard. Kept for one release as a pointer.
 */
@ApplyOptions<Command.Options>({
	description: 'View the prediction leaderboard (legacy alias)',
})
export class UserCommand extends Command {
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand(
			(builder) =>
				builder
					.setName('accuracy_leaderboard')
					.setDescription(this.description)
					.setContexts([InteractionContextType.Guild]),
			{ idHints: ['1297933995123933225'] },
		)
	}

	public override async chatInputRun(
		interaction: Command.ChatInputCommandInteraction,
	) {
		return sendPredictionCommandDeprecation(
			interaction,
			'/predictions leaderboard',
		)
	}
}
