import { ApplyOptions } from '@sapphire/decorators'
import { Subcommand } from '@sapphire/plugin-subcommands'
import { InteractionContextType, PermissionFlagsBits } from 'discord.js'
import { sendPredictionCommandDeprecation } from '../../utils/commands/prediction-deprecation.js'

/**
 * @deprecated Use /predictions history or /predictions stats. Kept for one
 * release so existing command registrations have a clear migration path.
 */
@ApplyOptions<Subcommand.Options>({
	name: 'prediction',
	description: 'View your predictions (legacy alias)',
	requiredClientPermissions: [
		PermissionFlagsBits.SendMessages,
		PermissionFlagsBits.EmbedLinks,
	],
	subcommands: [
		{ name: 'history', chatInputRun: 'handleHistory' },
		{ name: 'stats', chatInputRun: 'handleStats' },
	],
})
export class UserCommand extends Subcommand {
	public override registerApplicationCommands(registry: Subcommand.Registry) {
		registry.registerChatInputCommand(
			(builder) =>
				builder
					.setName(this.name)
					.setDescription(this.description)
					.setContexts(InteractionContextType.Guild)
					.addSubcommand((subcommand) =>
						subcommand
							.setName('history')
							.setDescription(
								'Legacy alias for /predictions history',
							),
					)
					.addSubcommand((subcommand) =>
						subcommand
							.setName('stats')
							.setDescription(
								'Legacy alias for /predictions stats',
							),
					),
			{ idHints: ['1298280482123026536'] },
		)
	}

	public async handleHistory(
		interaction: Subcommand.ChatInputCommandInteraction,
	) {
		return sendPredictionCommandDeprecation(
			interaction,
			'/predictions history',
		)
	}

	public async handleStats(
		interaction: Subcommand.ChatInputCommandInteraction,
	) {
		return sendPredictionCommandDeprecation(
			interaction,
			'/predictions stats',
		)
	}
}
