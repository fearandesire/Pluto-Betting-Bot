import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import GuildConfigWrapper from '../../utils/api/Khronos/guild/guild-config.wrapper.js';
import embedColors from '../../lib/colorsConfig.js';

enum DiscordConfigEnums {
	GAMES_CATEGORY = 'GAMES_CATEGORY',
	BETTING_CHANNEL = 'BETTING_CHAN',
	DAILY_SCHEDULE_CHAN = 'DAILY_SCHEDULE_CHAN',
	PREDICTIONS_CHAN = 'PREDICTIONS_CHAN',
	LOGS_CHAN = 'LOGS_CHAN',
	//	LOGS_ENABLED = 'LOGS_ENABLED',
}

@ApplyOptions<Command.Options>({
	description: 'Manage guild configurations',
})
export class UserCommand extends Command {
	private guildConfigWrapper = new GuildConfigWrapper();

	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand(
			(builder) =>
				builder //
					.setName(this.name)
					.setDescription(this.description)
					.setDMPermission(false)
					.setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
					.addSubcommand((subcommand) =>
						subcommand
							.setName('set')
							.setDescription('Set a guild configuration')
							.addStringOption((option) =>
								option
									.setName('type')
									.setDescription('The type of configuration')
									.setRequired(true)
									.addChoices(
										...Object.entries(DiscordConfigEnums).map(
											([key, value]) => ({
												name: key,
												value: value,
											}),
										),
									),
							)
							.addStringOption((option) =>
								option
									.setName('value')
									.setDescription(
										'The value of the configuration. E.g channel or category ID',
									)
									.setRequired(true),
							),
					),
			{
				idHints: ['1298717775287812096'],
			},
		);
	}

	public override async chatInputRun(
		interaction: Command.ChatInputCommandInteraction,
	) {
		await interaction.deferReply({
			ephemeral: true,
		});
		const subcommand = interaction.options.getSubcommand();
		const type = interaction.options.getString(
			'type',
			true,
		) as DiscordConfigEnums;
		const value = interaction.options.getString('value', true);
		const guildId = interaction.guildId;

		if (!guildId) {
			return interaction.editReply({
				content: 'This command can only be used in a guild.',
			});
		}

		try {
			if (subcommand === 'add') {
				await this.addConfig(interaction, guildId, type, value);
			}
		} catch (error) {
			await this.handleError(interaction, error);
		}
	}

	private async addConfig(
		interaction: Command.ChatInputCommandInteraction,
		guildId: string,
		type: DiscordConfigEnums,
		value: string,
	) {
		await this.guildConfigWrapper.setGuildConfig({
			guild_id: guildId,
			setting_type: type,
			setting_value: value,
		});

		const embed = new EmbedBuilder()
			.setColor(embedColors.success)
			.setTitle('Configuration Set')
			.setDescription(`Successfully set configuration for ${type}`)
			.addFields({ name: 'Value', value });

		await interaction.editReply({ embeds: [embed] });
	}

	private async handleError(
		interaction: Command.ChatInputCommandInteraction,
		error: unknown,
	) {
		let fieldValue = 'Unknown error';
		if (error instanceof Error && error.message) {
			fieldValue = error.message;
		}
		const errorEmbed = new EmbedBuilder()
			.setColor(embedColors.error)
			.setTitle('Error')
			.setDescription('An error occurred while processing your request.')
			.addFields({ name: 'Details', value: fieldValue });

		await interaction.editReply({ embeds: [errorEmbed] });
	}
}
