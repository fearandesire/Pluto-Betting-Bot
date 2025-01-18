import { ApplyOptions } from '@sapphire/decorators';
import { type ApplicationCommandRegistry, Command } from '@sapphire/framework';
import { PermissionFlagsBits } from 'discord.js';
import { plutoGuildId } from './../../lib/configs/constants.js';

@ApplyOptions<Command.Options>({
	description: 'Manage bot commands',
	preconditions: ['OwnerOnly'],
})
export class ManageCommandsCommand extends Command {
	public override registerApplicationCommands(
		registry: ApplicationCommandRegistry,
	) {
		registry.registerChatInputCommand(
			(builder) =>
				builder
					.setName('manage-commands')
					.setDescription(this.description)
					.setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
					.addSubcommand((subcommand) =>
						subcommand
							.setName('view')
							.setDescription('View all registered commands and their IDs'),
					)
					.addSubcommand((subcommand) =>
						subcommand
							.setName('delete')
							.setDescription('Delete a command by its ID')
							.addStringOption((option) =>
								option
									.setName('command_id')
									.setDescription('The ID of the command to delete')
									.setRequired(true),
							),
					)
					.addSubcommand((subcommand) =>
						subcommand
							.setName('view-global')
							.setDescription(
								'View all globally registered commands and their IDs',
							),
					)
					.addSubcommand((subcommand) =>
						subcommand
							.setName('delete-global')
							.setDescription(
								'Delete one or more globally registered commands by their IDs',
							)
							.addStringOption((option) =>
								option
									.setName('command_ids')
									.setDescription(
										'The ID(s) of the global command(s) to delete, separated by commas',
									)
									.setRequired(true),
							),
					),
			{ idHints: ['1290465328995766333'], guildIds: [plutoGuildId] },
		);
	}

	public override async chatInputRun(
		interaction: Command.ChatInputCommandInteraction,
	) {
		const subcommand = interaction.options.getSubcommand();

		if (subcommand === 'view') {
			return this.viewCommands(interaction);
		}
		if (subcommand === 'delete') {
			return this.deleteCommand(interaction);
		}
		if (subcommand === 'view-global') {
			return this.viewGlobalCommands(interaction);
		}
		if (subcommand === 'delete-global') {
			return this.deleteGlobalCommand(interaction);
		}
	}

	private async viewCommands(interaction: Command.ChatInputCommandInteraction) {
		await interaction.deferReply({ ephemeral: true });

		const commands = await interaction.guild!.commands.fetch();
		const commandList = commands
			.map((cmd) => `${cmd.name} (ID: ${cmd.id})`)
			.join('\n');

		return interaction.editReply({
			content: `Registered commands:\n\`\`\`\n${commandList}\n\`\`\``,
		});
	}

	private async deleteCommand(
		interaction: Command.ChatInputCommandInteraction,
	) {
		const commandId = interaction.options.getString('command_id', true);

		try {
			await interaction.guild!.commands.delete(commandId);
			return interaction.reply({
				content: `Command with ID ${commandId} has been successfully deleted.`,
				ephemeral: true,
			});
		} catch (error) {
			this.container.logger.error(error);
			return interaction.reply({
				content: `Failed to delete command with ID ${commandId}. Please check if the ID is correct and try again.`,
				ephemeral: true,
			});
		}
	}

	private async viewGlobalCommands(
		interaction: Command.ChatInputCommandInteraction,
	) {
		await interaction.deferReply({ ephemeral: true });

		try {
			const globalCommands =
				await this.container.client.application?.commands.fetch();

			if (!globalCommands) {
				return interaction.editReply({
					content:
						'Unable to fetch global commands. Make sure the bot has the necessary permissions.',
				});
			}

			const commandList = globalCommands
				.map((cmd) => `${cmd.name} (ID: ${cmd.id})`)
				.join('\n');

			return interaction.editReply({
				content: `Globally registered commands:\n\`\`\`\n${commandList}\n\`\`\``,
			});
		} catch (error) {
			this.container.logger.error(error);
			return interaction.editReply({
				content: 'An error occurred while fetching global commands.',
			});
		}
	}

	private async deleteGlobalCommand(
		interaction: Command.ChatInputCommandInteraction,
	) {
		await interaction.deferReply({ ephemeral: true });

		const commandIds = interaction.options
			.getString('command_ids', true)
			.split(',')
			.map((id) => id.trim());

		const results: string[] = [];

		for (const commandId of commandIds) {
			try {
				await this.container.client.application?.commands.delete(commandId);
				results.push(`Deleted cmd (${commandId})`);
			} catch (error) {
				this.container.logger.error(error);
				results.push(`Failed to delete cmd (${commandId}).`);
			}
		}

		return interaction.editReply({
			content: results.join('\n'),
		});
	}
}
