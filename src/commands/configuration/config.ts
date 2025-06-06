import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import {
	EmbedBuilder,
	InteractionContextType,
	PermissionFlagsBits,
} from 'discord.js';
import embedColors from '../../lib/colorsConfig.js';
import { DiscordConfigSettingTypeEnum } from '../../openapi/khronos/models/DiscordConfig.js';
import GuildConfigWrapper from '../../utils/api/Khronos/guild/guild-config.wrapper.js';
import GuildWrapper from '../../utils/api/Khronos/guild/guild-wrapper.js';
import StringUtils from '../../utils/common/string-utils.js';

@ApplyOptions<Command.Options>({
	description: 'Manage guild configurations',
})
export class UserCommand extends Command {
	private guildConfigWrapper = new GuildConfigWrapper();
	private guildWrapper = new GuildWrapper();

	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand(
			(builder) =>
				builder //
					.setName(this.name)
					.setDescription(this.description)
					.setContexts(InteractionContextType.Guild)
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
										...Object.entries(DiscordConfigSettingTypeEnum).map(
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
					)
					.addSubcommand((subcommand) =>
						subcommand
							.setName('view')
							.setDescription('View current guild configurations'),
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
			ephemeral: false,
		});
		const subcommand = interaction.options.getSubcommand();
		const guildId = interaction.guildId;

		if (!guildId) {
			return interaction.editReply({
				content: 'This command can only be used in a guild.',
			});
		}

		try {
			if (subcommand === 'set') {
				const type = interaction.options.getString(
					'type',
					true,
				) as DiscordConfigSettingTypeEnum;
				const value = interaction.options.getString('value', true);
				await this.addConfig(interaction, guildId, type, value);
			} else if (subcommand === 'view') {
				await this.viewConfig(interaction, guildId);
			}
		} catch (error) {
			await this.handleError(interaction, error);
		}
	}

	private async addConfig(
		interaction: Command.ChatInputCommandInteraction,
		guildId: string,
		type: DiscordConfigSettingTypeEnum,
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

	private async viewConfig(
		interaction: Command.ChatInputCommandInteraction,
		guildId: string,
	) {
		const guild = await this.guildWrapper.getGuild(guildId);
		const definedSettings = new Map<string, string>();

		// Populate defined settings from the discordConfig array
		for (const setting of guild.config) {
			definedSettings.set(setting.setting_type, setting.setting_value);
		}

		const embed = new EmbedBuilder()
			.setColor(embedColors.info)
			.setTitle(`${interaction.guild.name} Guild Configuration`)
			.setDescription(
				'Here are the current configuration settings for this guild.\nSet / Change using `/config set`',
			);

		for (const [key, value] of Object.entries(DiscordConfigSettingTypeEnum)) {
			// Parse the name to be human-readable
			let configName = key.replace(/_/g, ' ');
			configName = StringUtils.toTitleCase(configName);
			const settingValue = definedSettings.get(value) || 'Not set';
			embed.addFields({ name: configName, value: settingValue });
		}

		embed.setAuthor({
			name: interaction.user.username,
			iconURL: interaction.user.displayAvatarURL(),
		});

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
