import { LogType } from '../../utils/logging/AppLog.interface.js';
import { Subcommand } from '@sapphire/plugin-subcommands';
import { PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import PropsApiWrapper from '../../utils/api/Khronos/props/propsApiWrapper.js';
import type { Prop } from '../../openapi/khronos/models/Prop.js';
import type { UpdatePropResultDto } from '../../openapi/khronos/models/UpdatePropResultDto.js';
import type { UpdatePropResultResponseDto } from '../../openapi/khronos/models/index.js';
import { MarketKeyTranslations } from '@pluto-api-interfaces';
import { DateManager } from '../../utils/common/DateManager.js';
import TeamInfo from '../../utils/common/TeamInfo.js';
import AppLog from '../../utils/logging/AppLog.js';
import StringUtils from '../../utils/common/string-utils.js';
import { ApiErrorHandler } from '../../utils/api/Khronos/error-handling/ApiErrorHandler.js';
import { ApiModules } from '../../lib/interfaces/api/api.interface.js';
import { PaginatedMessageEmbedFields } from '@sapphire/discord.js-utilities';
import embedColors from '../../lib/colorsConfig.js';

export class UserCommand extends Subcommand {
	public constructor(
		context: Subcommand.LoaderContext,
		options: Subcommand.Options,
	) {
		super(context, {
			...options,
			name: 'props',
			description: 'Manage props',
			subcommands: [
				{
					name: 'view',
					type: 'group',
					entries: [{ name: 'active', chatInputRun: 'viewActive' }],
				},
				{
					name: 'manage',
					type: 'group',
					entries: [{ name: 'setresult', chatInputRun: 'manageSetresult' }],
				},
			],
		});
	}

	public override registerApplicationCommands(registry: Subcommand.Registry) {
		registry.registerChatInputCommand(
			(builder) =>
				builder
					.setName(this.name)
					.setDescription(this.description)
					.setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
					.addSubcommandGroup((group) =>
						group
							.setName('view')
							.setDescription('View props')
							.addSubcommand((subcommand) =>
								subcommand
									.setName('active')
									.setDescription('View props with active predictions'),
							),
					)
					.addSubcommandGroup((group) =>
						group
							.setName('manage')
							.setDescription('Manage props')
							.addSubcommand((subcommand) =>
								subcommand
									.setName('setresult')
									.setDescription('Set the result of a prop')
									.addStringOption((option) =>
										option
											.setName('prop_id')
											.setDescription('The ID of the prop')
											.setRequired(true),
									)
									.addStringOption((option) =>
										option
											.setName('result')
											.setDescription('The result of the prop')
											.setRequired(true),
									),
							),
					),
			{
				idHints: ['1289689518940622919', '1290465537859784745'],
			},
		);
	}

	public async viewActive(interaction: Subcommand.ChatInputCommandInteraction) {
		await interaction.deferReply();
		return this.viewActiveProps(interaction);
	}

	public async manageSetresult(
		interaction: Subcommand.ChatInputCommandInteraction,
	) {
		return this.setResult(interaction);
	}

	private async setResult(interaction: Subcommand.ChatInputCommandInteraction) {
		const propId = interaction.options.getString('prop_id', true);
		const result = interaction.options.getString('result', true);

		const propsApi = new PropsApiWrapper();

		try {
			await interaction.deferReply();

			const response = await propsApi.setResult({
				updatePropResultDto: {
					propId,
					winner: result,
					status: 'completed' as UpdatePropResultDto['status'],
					user_id: interaction.user.id,
				},
				override: false,
			});

			const embed = this.createResultEmbed(response);

			await AppLog.log({
				guildId: interaction.guildId,
				description: `Prop result updated for ${propId}`,
				type: LogType.Info,
			});

			return interaction.editReply({ embeds: [embed] });
		} catch (error) {
			this.container.logger.error(error);
			return new ApiErrorHandler().handle(interaction, error, ApiModules.props);
		}
	}

	private createResultEmbed(
		response: UpdatePropResultResponseDto,
	): EmbedBuilder {
		const embed = new EmbedBuilder()
			.setTitle('Prop Result Updated')
			.setColor(embedColors.PlutoGreen)
			.addFields(
				{
					name: 'Correct Predictions',
					value: response.correct_predictions_count.toString(),
					inline: true,
				},
				{
					name: 'Incorrect Predictions',
					value: response.incorrect_predictions_count.toString(),
					inline: true,
				},
				{
					name: 'Total Predictions',
					value: response.total_predictions_count.toString(),
					inline: true,
				},
			);

		return embed;
	}

	private async viewActiveProps(
		interaction: Subcommand.ChatInputCommandInteraction,
	) {
		const propsApi = new PropsApiWrapper();

		try {
			const props: Prop[] = await propsApi.getAll({
				guildId: interaction.guildId,
				withActivePredictions: true,
			});

			return this.sendPropsEmbed(
				interaction,
				props,
				'Active Props',
				'Displaying props with active predictions',
				{ isViewingActiveProps: true },
			);
		} catch (error) {
			this.container.logger.error(error);
			return new ApiErrorHandler().handle(interaction, error, ApiModules.props);
		}
	}

	private async sendPropsEmbed(
		interaction: Subcommand.ChatInputCommandInteraction,
		props: Prop[],
		title: string,
		description: string,
		options?: PropEmbedOptions,
	) {
		try {
			if (props.length === 0) {
				return interaction.editReply({
					content: 'No props were found matching the search criteria.',
				});
			}

			const templateEmbed = new EmbedBuilder()
				.setTitle(title)
				.setDescription(description)
				.setColor(embedColors.PlutoBlue)
				.setTimestamp();

			if (options?.isViewingActiveProps) {
				const formattedProps = await Promise.all(
					props.map((prop) => this.formatPropField(prop)),
				);

				const paginatedMsg = new PaginatedMessageEmbedFields({
					template: { embeds: [templateEmbed] },
				})
					.setItems(formattedProps)
					.setItemsPerPage(15)
					.make();

				return paginatedMsg.run(interaction);
			}

			const firstProp = props[0];
			const date = new DateManager().toDiscordUnix(firstProp.commence_time);

			templateEmbed.setDescription(
				`${description}\n\n**Event Information**\n🆔 **Event ID:** \`${firstProp.event_id}\`\n🗓️ **Date:** ${date}\n${firstProp.home_team} vs ${firstProp.away_team}`,
			);

			const formattedProps = await Promise.all(
				props.map((prop) => this.formatPropField(prop)),
			);

			templateEmbed.addFields(formattedProps);
			return interaction.editReply({ embeds: [templateEmbed] });
		} catch (error) {
			this.container.logger.error(error);
			return new ApiErrorHandler().handle(interaction, error, ApiModules.props);
		}
	}

	private async formatPropField(
		prop: Prop,
	): Promise<{ name: string; value: string; inline: boolean }> {
		const {
			home_team,
			away_team,
			market_key,
			description,
			point,
			id,
			commence_time,
		} = prop;

		const homeTeam = await TeamInfo.resolveTeamIdentifier(home_team);
		const awayTeam = await TeamInfo.resolveTeamIdentifier(away_team);
		const matchup = `${homeTeam} vs. ${awayTeam}`;

		const translatedKey = StringUtils.toTitleCase(
			MarketKeyTranslations[market_key],
		);

		let title: string;
		if (description) {
			title = `${description} - ${translatedKey}`;
		} else if (market_key.toLowerCase() === 'h2h') {
			title = `${matchup} - H2H`;
		} else if (market_key.toLowerCase().includes('total')) {
			title = `${matchup} - Totals`;
		} else {
			title = `${matchup} - ${translatedKey}`;
		}

		const details = [`**Prop ID:** \`${id}\``];

		if (
			point !== null &&
			market_key.toLowerCase() !== 'h2h' &&
			!market_key.toLowerCase().includes('total')
		) {
			details.push(`**Over/Under:** ${point}`);
		}

		const date = new DateManager().toDiscordUnix(commence_time);
		details.push(`**Date:** ${date}`);

		return {
			name: title,
			value: details.join('\n'),
			inline: true,
		};
	}
}

interface PropEmbedOptions {
	isViewingActiveProps?: boolean;
}
