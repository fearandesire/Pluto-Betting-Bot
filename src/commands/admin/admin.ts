import { ApplyOptions } from '@sapphire/decorators'
import { Subcommand } from '@sapphire/plugin-subcommands'
import { InteractionContextType, PermissionFlagsBits } from 'discord.js'
import { AdminPredictionsHandler } from '../../utils/admin-handlers/admin-predictions-handler.js'
import { AdminPropsHandler } from '../../utils/admin-handlers/admin-props-handler.js'

// Autocomplete convention: see docs/architecture/decisions/002-autocomplete-provider-pattern.md.
// The `prop_id` option (and other prop autocompletes) follow the thin-adapter pattern: the
// adapter extracts context and delegates all suggestion logic to PropSuggestionProvider
// (no inline cache lookups, API calls, or filtering in the handler/listener).

/**
 * Admin command for managing predictions and props across the server
 *
 * Subcommand Groups:
 * - /admin predictions view <user> - View any user's predictions
 * - /admin predictions delete <user> <id> - Delete a specific prediction
 * - /admin props generate <count> - Generate and post props to channel
 * - /admin props viewactive - View all props with active predictions
 */
@ApplyOptions<Subcommand.Options>({
	name: 'admin',
	description: 'Admin commands for managing predictions and props',
	requiredClientPermissions: [
		PermissionFlagsBits.SendMessages,
		PermissionFlagsBits.EmbedLinks,
	],
	subcommands: [
		{
			name: 'predictions',
			type: 'group',
			entries: [
				{ name: 'view', chatInputRun: 'predictionsView' },
				{ name: 'delete', chatInputRun: 'predictionsDelete' },
			],
		},
		{
			name: 'props',
			type: 'group',
			entries: [
				{ name: 'generate', chatInputRun: 'propsGenerate' },
				{ name: 'viewactive', chatInputRun: 'propsViewactive' },
			],
		},
	],
})
export class UserCommand extends Subcommand {
	private predictionsHandler: AdminPredictionsHandler
	private propsHandler: AdminPropsHandler

	public constructor(
		context: Subcommand.LoaderContext,
		options: Subcommand.Options,
	) {
		super(context, options)
		this.predictionsHandler = new AdminPredictionsHandler()
		this.propsHandler = new AdminPropsHandler()
	}

	public override registerApplicationCommands(registry: Subcommand.Registry) {
		registry.registerChatInputCommand(
			(builder) =>
				builder
					.setName(this.name)
					.setDescription(this.description)
					.setContexts(InteractionContextType.Guild)
					.setDefaultMemberPermissions(
						PermissionFlagsBits.Administrator,
					)
					// Predictions subcommand group
					.addSubcommandGroup((group) =>
						group
							.setName('predictions')
							.setDescription('Manage user predictions')
							.addSubcommand((subcommand) =>
								subcommand
									.setName('view')
									.setDescription(
										'View active predictions for any user',
									)
									.addUserOption((option) =>
										option
											.setName('user')
											.setDescription(
												'The user to view predictions for',
											)
											.setRequired(true),
									),
							)
							.addSubcommand((subcommand) =>
								subcommand
									.setName('delete')
									.setDescription(
										'Delete a specific prediction',
									)
									.addUserOption((option) =>
										option
											.setName('user')
											.setDescription(
												'The user whose prediction to delete',
											)
											.setRequired(true),
									)
									.addStringOption((option) =>
										option
											.setName('prediction_id')
											.setDescription(
												"The prediction ID to delete (last 8 chars, e.g., 'abcd1234')",
											)
											.setRequired(true),
									),
							),
					)
					// Props subcommand group
					.addSubcommandGroup((group) =>
						group
							.setName('props')
							.setDescription('Manage props')
							.addSubcommand((subcommand) =>
								subcommand
									.setName('generate')
									.setDescription(
										'Generate and post prop embeds to channel',
									)
									.addIntegerOption((option) =>
										option
											.setName('count')
											.setDescription(
												'Number of props to generate (default: 10)',
											)
											.setRequired(false)
											.setMinValue(1)
											.setMaxValue(50),
									),
							)
							.addSubcommand((subcommand) =>
								subcommand
									.setName('viewactive')
									.setDescription(
										'View props with active predictions',
									),
							),
					),
			{
				idHints: [],
			},
		)
	}

	// Predictions subcommand handlers
	public async predictionsView(
		interaction: Subcommand.ChatInputCommandInteraction,
	) {
		return this.predictionsHandler.handleView(interaction)
	}

	public async predictionsDelete(
		interaction: Subcommand.ChatInputCommandInteraction,
	) {
		return this.predictionsHandler.handleDelete(interaction)
	}

	// Props subcommand handlers
	public async propsGenerate(
		interaction: Subcommand.ChatInputCommandInteraction,
	) {
		return this.propsHandler.handleGenerate(interaction)
	}

	public async propsViewactive(
		interaction: Subcommand.ChatInputCommandInteraction,
	) {
		return this.propsHandler.handleViewactive(interaction)
	}
}
