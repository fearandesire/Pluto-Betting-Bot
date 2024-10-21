import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { LeaderboardControllerGetLeaderboardTimeFrameEnum } from '../../openapi/khronos/apis/LeaderboardApi.js';
import LeaderboardWrapper from '../../utils/api/Khronos/leaderboard/leaderboard-wrapper.js';
import type { LeaderboardDto } from '../../openapi/khronos/models/index.js';
import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	EmbedBuilder,
	type Message,
} from 'discord.js';
import embedColors from '../../lib/colorsConfig.js';
import Pagination from '../../utils/embeds/pagination.js';

@ApplyOptions<Command.Options>({
	description: 'View the leaderboard for accuracy challenge',
})
export class UserCommand extends Command {
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand(
			(builder) =>
				builder
					.setName('prediction_leaderboard')
					.setDescription(this.description)
					.setDMPermission(false)
					.addStringOption((option) =>
						option
							.setName('timeframe')
							.setDescription('The time frame for the leaderboard')
							.setRequired(true)
							.addChoices(
								{
									name: 'Weekly',
									value:
										LeaderboardControllerGetLeaderboardTimeFrameEnum.Weekly,
								},
								{
									name: 'Seasonal',
									value:
										LeaderboardControllerGetLeaderboardTimeFrameEnum.Seasonal,
								},
								{
									name: 'All Time',
									value:
										LeaderboardControllerGetLeaderboardTimeFrameEnum.AllTime,
								},
							),
					)
					.addIntegerOption((option) =>
						option
							.setName('week_number')
							.setDescription('The week number to view.')
							.setMinValue(1)
							.setRequired(true),
					),
			{
				idHints: ['1297933995123933225'],
			},
		);
	}

	public override async chatInputRun(
		interaction: Command.ChatInputCommandInteraction,
	) {
		// Collect options provided
		const timeFrame = interaction.options.getString(
			'timeframe',
			true,
		) as LeaderboardControllerGetLeaderboardTimeFrameEnum;
		const weekNumber = interaction.options.getInteger('week_number', true);
		const guildId = interaction.guildId;

		const currentYear = new Date().getFullYear();

		try {
			const leaderboardWrapper = new LeaderboardWrapper();
			const leaderboard = await leaderboardWrapper.getLeaderboard({
				guildId,
				weekNumber,
				seasonYear: currentYear,
				timeFrame,
			});

			const parsedLeaderboard = this.parseLeaderboard(leaderboard);
			const embed = this.createLeaderboardEmbed(
				parsedLeaderboard,
				weekNumber,
				1,
			);
			const pagination = new Pagination();
			const components = pagination.createPaginationButtons(
				1,
				Math.ceil(parsedLeaderboard.length / 20),
			);

			const reply = await interaction.reply({
				embeds: [embed],
				components,
				fetchReply: true,
			});

			this.handlePagination(interaction, reply, parsedLeaderboard, weekNumber);
		} catch (error) {
			this.container.logger.error(error);
			return interaction.reply({
				content: 'An error occurred while fetching the leaderboard.',
				ephemeral: true,
			});
		}
	}

	private parseLeaderboard(
		leaderboard: LeaderboardDto[],
	): ParsedLeaderboardEntry[] {
		return leaderboard.map((entry, index) => ({
			position: index + 1,
			userId: entry.user_id,
			score: entry.score,
			correctPredictions: entry.correctPredictions,
			incorrectPredictions: entry.incorrectPredictions,
		}));
	}

	private createLeaderboardEmbed(
		leaderboard: ParsedLeaderboardEntry[],
		weekNumber: number,
		currentPage: number,
	): EmbedBuilder {
		const startIndex = (currentPage - 1) * 20;
		const endIndex = startIndex + 20;
		const pageEntries = leaderboard.slice(startIndex, endIndex);
		const totalPages = Math.ceil(leaderboard.length / 20);
		const embed = new EmbedBuilder()
			.setTitle(`Leaderboard | Week ${weekNumber}`)
			.setColor(embedColors.PlutoBlue)
			.setDescription(
				pageEntries
					.map(
						(entry) =>
							`${entry.position}. <@${entry.userId}> - Score: ${entry.score} (${entry.correctPredictions}/${
								entry.correctPredictions + entry.incorrectPredictions
							})`,
					)
					.join('\n'),
			)
			.setFooter({
				text: `Page ${currentPage} of ${Math.ceil(leaderboard.length / 20)}`,
			});

		return embed;
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

			const newEmbed = this.createLeaderboardEmbed(
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
