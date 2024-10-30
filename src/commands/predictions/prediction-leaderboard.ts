import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { LeaderboardControllerGetLeaderboardTimeFrameEnum } from '../../openapi/khronos/apis/LeaderboardApi.js';
import LeaderboardWrapper from '../../utils/api/Khronos/leaderboard/leaderboard-wrapper.js';
import type { LeaderboardDto } from '../../openapi/khronos/models/index.js';
import { EmbedBuilder, type Message } from 'discord.js';
import embedColors from '../../lib/colorsConfig.js';
import Pagination from '../../utils/embeds/pagination.js';
import ClientTools from '../../utils/bot_res/ClientTools.js';
import _ from 'lodash';

@ApplyOptions<Command.Options>({
	description: 'View the leaderboard for accuracy challenge',
})
export class UserCommand extends Command {
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand(
			(builder) =>
				builder
					.setName('accuracy_leaderboard')
					.setDescription(this.description)
					.setDMPermission(false)
					.addSubcommand((subcommand) =>
						subcommand
							.setName('weekly')
							.setDescription('View the weekly leaderboard')
							.addIntegerOption((option) =>
								option
									.setName('week_number')
									.setDescription('The week number to view.')
									.setMinValue(1)
									.setRequired(true),
							),
					)
					.addSubcommand((subcommand) =>
						subcommand
							.setName('seasonal')
							.setDescription('View the seasonal leaderboard'),
					)
					.addSubcommand((subcommand) =>
						subcommand
							.setName('all_time')
							.setDescription('View the all-time leaderboard'),
					),
			{
				idHints: ['1297933995123933225'],
			},
		);
	}

	public override async chatInputRun(
		interaction: Command.ChatInputCommandInteraction,
	) {
		await interaction.deferReply();
		const subcommand = interaction.options.getSubcommand();

		switch (subcommand) {
			case 'weekly':
				await this.handleWeeklyLeaderboard(interaction);
				break;
			case 'seasonal':
			case 'all_time':
				await this.handleUnavailableLeaderboard(interaction, subcommand);
				break;
			default:
				await interaction.editReply({
					content: 'Invalid subcommand.',
				});
		}
	}

	private async handleWeeklyLeaderboard(
		interaction: Command.ChatInputCommandInteraction,
	) {
		const weekNumber = interaction.options.getInteger('week_number', true);
		const guildId = interaction.guildId;
		const currentYear = new Date().getFullYear();

		try {
			const leaderboardWrapper = new LeaderboardWrapper();
			const leaderboard = await leaderboardWrapper.getLeaderboard({
				guildId,
				weekNumber,
				seasonYear: currentYear,
				timeFrame: LeaderboardControllerGetLeaderboardTimeFrameEnum.Weekly,
			});

			if (!leaderboard || _.isEmpty(leaderboard)) {
				return interaction.editReply({
					content:
						'No leaderboard data found for the specified week. Please try again with a different week number.',
				});
			}

			const thumbnail = interaction.guild?.iconURL({ extension: 'png' });
			const parsedLeaderboard = await this.parseLeaderboard(leaderboard);

			if (!parsedLeaderboard || _.isEmpty(parsedLeaderboard)) {
				return interaction.editReply({
					content:
						'Unable to process leaderboard data. Please try again later.',
				});
			}

			const embed = await this.createLeaderboardEmbed(
				parsedLeaderboard,
				weekNumber,
				1,
				{ thumbnail },
			);
			const pagination = new Pagination();
			const components = pagination.createPaginationButtons(
				1,
				Math.ceil(parsedLeaderboard.length / 20),
			);

			const reply = await interaction.editReply({
				embeds: [embed],
				components,
			});

			this.handlePagination(interaction, reply, parsedLeaderboard, weekNumber);
		} catch (error) {
			this.container.logger.error(error);
			return interaction.editReply({
				content: 'An error occurred while fetching the leaderboard.',
			});
		}
	}

	private async handleUnavailableLeaderboard(
		interaction: Command.ChatInputCommandInteraction,
		type: 'seasonal' | 'all_time',
	) {
		const embed = new EmbedBuilder()
			.setTitle(`${type.charAt(0).toUpperCase() + type.slice(1)} Leaderboard`)
			.setColor(embedColors.PlutoBlue)
			.setDescription(
				`Only viewing the Weekly leaderboard is currently available. The ${type} leaderboard is being actively developed and will be available soon.`,
			);

		await interaction.editReply({ embeds: [embed] });
	}

	private async parseLeaderboard(
		leaderboard: LeaderboardDto[],
	): Promise<ParsedLeaderboardEntry[]> {
		return leaderboard.map((entry, index) => ({
			position: index + 1,
			userId: entry.user_id,
			score: entry.score,
			correctPredictions: entry.correct_predictions,
			incorrectPredictions: entry.incorrect_predictions,
		}));
	}

	private async createLeaderboardEmbed(
		leaderboard: ParsedLeaderboardEntry[],
		weekNumber: number,
		currentPage: number,
		metadata?: {
			thumbnail?: string;
		},
	): Promise<EmbedBuilder> {
		const startIndex = (currentPage - 1) * 20;
		const endIndex = startIndex + 20;
		const pageEntries = leaderboard.slice(startIndex, endIndex);
		const totalPages = Math.ceil(leaderboard.length / 20);

		const descriptionLines = await Promise.all(
			pageEntries.map(async (entry) => {
				const member = await this.getMember(entry.userId);
				const username = member ? member.username : entry.userId;
				const total = entry.correctPredictions + entry.incorrectPredictions;
				return `${entry.position}. ${username} - **\`${entry.score}\`** *(${entry.correctPredictions}/${total})*`;
			}),
		);

		const embed = new EmbedBuilder()
			.setTitle(`Leaderboard | Week ${weekNumber}`)
			.setColor(embedColors.PlutoBlue)
			.setDescription(descriptionLines.join('\n'))
			.setFooter({
				text: `Page ${currentPage} of ${totalPages}`,
			});

		if (metadata?.thumbnail) {
			embed.setThumbnail(metadata.thumbnail);
		}

		return embed;
	}

	private async getMember(userId: string) {
		return await new ClientTools(this.container).resolveMember(userId);
	}

	private async handlePagination(
		interaction: Command.ChatInputCommandInteraction,
		reply: Message,
		leaderboard: ParsedLeaderboardEntry[],
		weekNumber: number,
	) {
		const totalPages = Math.ceil(leaderboard.length / 20);
		let currentPage = 1;

		const collector = reply.createMessageComponentCollector({ time: 60000 });

		collector.on('collect', async (i) => {
			if (i.user.id !== interaction.user.id) {
				await i.reply({
					content: 'You cannot use these buttons.',
					ephemeral: true,
				});
				return;
			}

			switch (i.customId) {
				case 'first':
					currentPage = 1;
					break;
				case 'previous':
					currentPage = Math.max(1, currentPage - 1);
					break;
				case 'next':
					currentPage = Math.min(totalPages, currentPage + 1);
					break;
				case 'last':
					currentPage = totalPages;
					break;
			}

			const newEmbed = await this.createLeaderboardEmbed(
				leaderboard,
				weekNumber,
				currentPage,
			);
			const pagination = new Pagination();
			const newComponents = pagination.createPaginationButtons(
				currentPage,
				totalPages,
			);

			await i.update({ embeds: [newEmbed], components: newComponents });
		});

		collector.on('end', async () => {
			const pagination = new Pagination();
			const disabledComponents = pagination
				.createPaginationButtons(currentPage, totalPages)
				.map((row) => {
					for (const button of row.components) {
						button.setDisabled(true);
					}
					return row;
				});

			await reply.edit({ components: disabledComponents });
		});
	}
	private validateOptions(interaction: Command.ChatInputCommandInteraction) {}
}

interface ParsedLeaderboardEntry {
	position: number;
	userId: string;
	score: number;
	correctPredictions: number;
	incorrectPredictions: number;
}
