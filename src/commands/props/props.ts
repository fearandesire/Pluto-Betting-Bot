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
						subcommand.setName('viewall').setDescription('View all props'),
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
			case 'viewall':
				return this.viewAllProps(interaction);
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

	private async viewAllProps(interaction: Command.ChatInputCommandInteraction) {
		const propsApi = new PropsApiWrapper();

		try {
			const props: Prop[] = await propsApi.getAll({
				withActivePredictions: true,
			});

			if (props.length === 0) {
				return interaction.reply({
					content: 'No props found.',
					ephemeral: true,
				});
			}

			const embed = new EmbedBuilder()
				.setTitle('Active Props')
				.setDescription('Displaying all props with active predictions')
				.setColor('#0099ff');

			for (const prop of props.slice(0, 25)) {
				embed.addFields({
					name: `${prop.description || prop.market_key} (ID: ${prop.id})`,
					value: `Sport: ${prop.sport_title}\nStatus: ${prop.status}\nResult: ${prop.result || 'N/A'}`,
				});
			}

			if (props.length > 25) {
				embed.setFooter({
					text: 'Showing first 25 props. Use a more specific command to see more.',
				});
			}

			return interaction.reply({ embeds: [embed] });
		} catch (error) {
			this.container.logger.error(error);
			return interaction.reply({
				content:
					'An error occurred while fetching props. Please try again later.',
				ephemeral: true,
			});
		}
	}
}
