import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import {
	ApplicationCommandOptionType,
	PermissionFlagsBits,
	EmbedBuilder,
} from 'discord.js';
import PropsApiWrapper from '../../utils/api/Khronos/props/propsApiWrapper.js';
import type { Prop } from '../../openapi/khronos/models/Prop.js';
import type {
	UpdatePropResultDto,
	UpdatePropResultDtoStatusEnum,
} from '../../openapi/khronos/models/UpdatePropResultDto.js';
import type { UpdatePropResultResponseDto } from '@khronos-index';
import PropEmbedManager from '../../utils/guilds/prop-embeds/PropEmbedManager.js';
import type { PropZod } from '@pluto-api-interfaces';
import { DateManager } from '../../utils/common/DateManager.js';

@ApplyOptions<Command.Options>({
	description: 'Manage props',
})
export class UserCommand extends Command {
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand(
			(builder) =>
				builder
					.setName(this.name)
					.setDescription(this.description)
					.setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
					.addSubcommand((subcommand) =>
						subcommand
							.setName('generate')
							.setDescription('Generate all prop embeds'),
					)
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
					)
					.addSubcommand((subcommand) =>
						subcommand
							.setName('viewupcoming')
							.setDescription('View props for upcoming events'),
					)
					.addSubcommand((subcommand) =>
						subcommand
							.setName('viewactive')
							.setDescription('View active props'),
					)
					.addSubcommand((subcommand) =>
						subcommand
							.setName('generate_prop_embed')
							.setDescription('Create a prop embed for a specific event')
							.addStringOption((option) =>
								option
									.setName('prop_id')
									.setDescription('The ID of the prop')
									.setRequired(true),
							)
							.addStringOption((option) =>
								option
									.setName('market_key')
									.setDescription('The market key for the prop')
									.setRequired(true),
							)
							.addStringOption((option) =>
								option
									.setName('player')
									.setDescription('The player name for the prop')
									.setRequired(true),
							),
					),
			{
				idHints: ['1288178546942021643', '1290465537859784745'],
				guildIds: ['777353407383339038'],
			},
		);
	}

	public override async chatInputRun(
		interaction: Command.ChatInputCommandInteraction,
	) {
		const subcommand = interaction.options.getSubcommand();

		switch (subcommand) {
			case 'generate':
				return this.generateProps(interaction);
			case 'setresult':
				return this.setResult(interaction);
			case 'viewactive':
				return this.viewActiveProps(interaction);
			case 'generate_prop_embed':
				return this.createPropEmbed(interaction);
			case 'viewupcoming':
				return this.viewUpcomingProps(interaction);
			default:
				return interaction.reply({
					content: 'Invalid subcommand',
					ephemeral: true,
				});
		}
	}

	private async generateProps(
		interaction: Command.ChatInputCommandInteraction,
	) {
		await new PropsApiWrapper().generateAllPropEmbeds();
		return interaction.reply({
			content: 'Prop Embeds populated successfully',
		});
	}

	private async setResult(interaction: Command.ChatInputCommandInteraction) {
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
				},
				override: true,
			});

			const embed = this.createResultEmbed(response);
			return interaction.editReply({ embeds: [embed] });
		} catch (error) {
			this.container.logger.error(error);
			if (error instanceof Error) {
				return interaction.editReply({
					content: error.message,
				});
			}
		}
	}

	private createResultEmbed(
		response: UpdatePropResultResponseDto,
	): EmbedBuilder {
		const embed = new EmbedBuilder()
			.setTitle('Prop Result Updated')
			.setColor('#00FF00')
			.addFields(
				{
					name: 'Correct Predictions',
					value: response.correctPredictions.toString(),
					inline: true,
				},
				{
					name: 'Incorrect Predictions',
					value: response.incorrectPredictions.toString(),
					inline: true,
				},
				{
					name: 'Total Predictions',
					value: response.totalPredictions.toString(),
					inline: true,
				},
			);

		return embed;
	}

	private async viewActiveProps(
		interaction: Command.ChatInputCommandInteraction,
	) {
		const propsApi = new PropsApiWrapper();

		try {
			const props: Prop[] = await propsApi.getAll({
				withActivePredictions: true,
			});

			return this.sendPropsEmbed(
				interaction,
				props,
				'Active Props',
				'Displaying props with active predictions',
			);
		} catch (error) {
			this.container.logger.error(error);
			return interaction.reply({
				content:
					'An error occurred while fetching props. Please try again later.',
				ephemeral: true,
			});
		}
	}

	private async viewUpcomingProps(
		interaction: Command.ChatInputCommandInteraction,
	) {
		const propsApi = new PropsApiWrapper();

		try {
			const props: Prop[] = await propsApi.getAll({ recent: true });

			return this.sendPropsEmbed(
				interaction,
				props,
				'All Recent Props',
				'Displaying all recent props',
			);
		} catch (error) {
			this.container.logger.error(error);
			return interaction.reply({
				content:
					'An error occurred while fetching props. Please try again later.',
				ephemeral: true,
			});
		}
	}

	private async sendPropsEmbed(
		interaction: Command.ChatInputCommandInteraction,
		props: Prop[],
		title: string,
		description: string,
	) {
		if (props.length === 0) {
			return interaction.reply({
				content: 'No props found.',
				ephemeral: true,
			});
		}

		const embed = new EmbedBuilder()
			.setTitle(`🏆 ${title}`)
			.setDescription(description)
			.setColor('#0099ff')
			.setTimestamp();

		props.slice(0, 25).forEach((prop, index) => {
			embed.addFields({
				name: `${index + 1}. ${prop.description || prop.market_key}`,
				value: this.formatPropField(prop),
			});
		});

		if (props.length > 25) {
			embed.setFooter({
				text: `Showing 25 out of ${props.length} props. Use a more specific command to see more.`,
			});
		}

		return interaction.reply({ embeds: [embed] });
	}

	private formatPropField(prop: Prop): string {
		let statusEmoji: string;
		let statusText: string;
		switch (prop.status) {
			case 'pending':
				statusEmoji = '🟡';
				statusText = 'Pending';
				break;
			case 'completed':
				statusEmoji = '🟢';
				statusText = 'Completed';
				break;
			case 'error':
				statusEmoji = '🔴';
				statusText = 'Error';
				break;
			default:
				statusEmoji = '⚪';
				statusText = 'Unknown';
		}

		const result = prop.result ? `✅ ${prop.result}` : '⏳ Pending';
		const date = prop.commence_time;

		return `${statusEmoji} **Status:** ${statusText}
				🏠 **Home Team:** ${prop.home_team}
				🏁 **Away Team:** ${prop.away_team}
				🗓️ **Date:** ${date}
				🆔 **ID:** ${prop.id}
				🎱 **Market Key:** ${prop.market_key}
				🎯 **Result:** ${result}`;
	}

	private async createPropEmbed(
		interaction: Command.ChatInputCommandInteraction,
	) {
		const propId = interaction.options.getString('prop_id', true);
		const marketKey = interaction.options
			.getString('market_key', true)
			.toLowerCase();
		const player = interaction.options.getString('player', true).toLowerCase();

		const propsApi = new PropsApiWrapper();

		try {
			await interaction.deferReply();

			const prop = (await propsApi.getPropById(propId)) as unknown as PropZod;

			if (!prop) {
				return interaction.editReply({
					content: `No prop found with ID: ${propId}`,
				});
			}

			// Log what we are comparing
			console.log(
				'Comparing ->',
				prop.market_key.toLowerCase(),
				marketKey.toLowerCase(),
				prop.description?.toLowerCase(),
				player.toLowerCase(),
			);
			if (
				prop.market_key.toLowerCase() !== marketKey.toLowerCase() ||
				prop.description?.toLowerCase() !== player.toLowerCase()
			) {
				return interaction.editReply({
					content:
						'The provided market key or player does not match the prop details.',
				});
			}

			const propEmbedManager = new PropEmbedManager(this.container.client);
			const HTEAM_TRANSFORMED = await propEmbedManager.transformTeamName(
				prop.home_team,
			);
			const AWTEAM_TRANSFORMED = await propEmbedManager.transformTeamName(
				prop.away_team,
			);

			const { embed, row } = await propEmbedManager.createSingleEmbed(prop, {
				HTEAM_TRANSFORMED,
				AWTEAM_TRANSFORMED,
			});

			await interaction.editReply({ embeds: [embed], components: [row] });
		} catch (error) {
			this.container.logger.error(error);
			return interaction.editReply({
				content:
					'An error occurred while creating the prop embed. Please try again later.',
			});
		}
	}
}
