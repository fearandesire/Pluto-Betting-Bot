import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { EmbedBuilder, type Message } from 'discord.js';
import _ from 'lodash';
import embedColors from '../../lib/colorsConfig.js';
import type { GetSeasonYearSportEnum } from '../../openapi/khronos/apis/CalendarApi.js';
import { LeaderboardControllerGetLeaderboardV1TimeFrameEnum } from '../../openapi/khronos/apis/LeaderboardApi.js';
import type { LeaderboardResponseDto } from '../../openapi/khronos/models/index.js';
import CalendarWrapper from '../../utils/api/Khronos/calendar/calendar-wrapper.js';
import GuildWrapper from '../../utils/api/Khronos/guild/guild-wrapper.js';
import LeaderboardWrapper from '../../utils/api/Khronos/leaderboard/leaderboard-wrapper.js';
import ClientTools from '../../utils/bot_res/ClientTools.js';
import Pagination from '../../utils/embeds/pagination.js';

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
					.setContexts([0])
					.addSubcommand((subcommand) =>
						subcommand
							.setName('weekly')
							.setDescription('View the weekly leaderboard')
							.addIntegerOption((option) =>
								option
									.setName('week_number')
									.setDescription('The week number to view.')
									.setMinValue(1)
									.setRequired(false),
							),
					)
					.addSubcommand((subcommand) =>
						subcommand
							.setName('monthly')
							.setDescription('View the monthly leaderboard (prior month)'),
					)
					.addSubcommand((subcommand) =>
						subcommand
							.setName('seasonal')
							.setDescription('View the seasonal leaderboard')
							.addIntegerOption((option) =>
								option
									.setName('year')
									.setDescription(
										'Season ending year (e.g. 2024 for the 2023-2024 season)',
									)
									.setMinValue(2000)
									.setMaxValue(9999)
									.setRequired(false),
							),
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
		// ? Retrieve guild for sport
		const { sport } = await new GuildWrapper().getGuild(interaction.guildId);
		switch (subcommand) {
			case 'weekly':
				await this.handleWeeklyLeaderboard(interaction, sport);
				break;
			case 'monthly':
				await this.handleMonthlyLeaderboard(interaction);
				break;
			case 'seasonal':
				await this.handleSeasonalLeaderboard(interaction);
				break;
			case 'all_time':
				await this.handleAllTimeLeaderboard(interaction);
				break;
			default:
				await interaction.editReply({
					content: 'Invalid subcommand.',
				});
		}
	}

	private async handleWeeklyLeaderboard(
		interaction: Command.ChatInputCommandInteraction,
		sport: string,
	) {
		const weekNumber =
			interaction.options.getInteger('week_number', false) ?? null;
		const guildId = interaction.guildId;
		const currentYear = await new CalendarWrapper().getSeasonYear({
			sport: sport as GetSeasonYearSportEnum,
		});

		try {
			const leaderboardWrapper = new LeaderboardWrapper();
			const leaderboard = await leaderboardWrapper.getLeaderboard({
				guildId,
				weekNumber,
				seasonYear: currentYear,
				timeFrame: LeaderboardControllerGetLeaderboardV1TimeFrameEnum.Weekly,
			});

			if (!leaderboard || _.isEmpty(leaderboard.entries)) {
				return interaction.editReply({
					content:
						'No leaderboard data found for the specified week. Please try again with a different week number.',
				});
			}

			const thumbnail = interaction.guild?.iconURL({ extension: 'png' });
			const parsedLeaderboard = await this.parseLeaderboardData(leaderboard);

			if (!parsedLeaderboard || _.isEmpty(parsedLeaderboard)) {
				return interaction.editReply({
					content:
						'Unable to process leaderboard data. Please try again later.',
				});
			}

			const weeklyTitle = weekNumber
				? `Week ${weekNumber}`
				: `Week ${leaderboard?.current_week}`;
			const embed = await this.createLeaderboardEmbed({
				leaderboardData: parsedLeaderboard,
				type: 'weekly',
				title: weeklyTitle,
				metadata: { thumbnail, currentWeek: leaderboard?.current_week },
			});
			const pagination = new Pagination();
			const components = pagination.createPaginationButtons(
				1,
				Math.ceil(parsedLeaderboard.length / 20),
			);

			const reply = await interaction.editReply({
				embeds: [embed],
				components,
			});

			await this.handlePagination(interaction, reply, parsedLeaderboard);
		} catch (error) {
			this.container.logger.error(error);
			return interaction.editReply({
				content: 'An error occurred while fetching the leaderboard.',
			});
		}
	}

	private async handleMonthlyLeaderboard(
		interaction: Command.ChatInputCommandInteraction,
	) {
		try {
			// ? Prep for query
			const guildId = interaction.guildId;
			const leaderboardMonthly = await new LeaderboardWrapper().getLeaderboard({
				guildId,
				timeFrame: LeaderboardControllerGetLeaderboardV1TimeFrameEnum.Monthly,
			});

			// ? Invalid Strings
			const noContent =
				'There were no entries to populate a monthly leaderboard from the prior month.';

			if (!leaderboardMonthly || leaderboardMonthly.entries.length === 0) {
				return interaction.editReply({
					content: noContent,
				});
			}
			const parsedLeaderboard =
				await this.parseLeaderboardData(leaderboardMonthly);
			const embed = await this.createLeaderboardEmbed({
				leaderboardData: parsedLeaderboard,
				type: 'monthly',
			});

			const reply = await interaction.editReply({ embeds: [embed] });
			await this.handlePagination(interaction, reply, parsedLeaderboard);
		} catch (error) {
			this.container.logger.error(error);
			return interaction.editReply({
				content: 'An error occurred while fetching the leaderboard.',
			});
		}
	}

	private async handleSeasonalLeaderboard(
		interaction: Command.ChatInputCommandInteraction,
	) {
		try {
			const guildId = interaction.guildId;
			const { sport } = await new GuildWrapper().getGuild(guildId);
			const defaultYear = await new CalendarWrapper().getSeasonYear({
				sport: sport as GetSeasonYearSportEnum,
			});
			const year = interaction.options.getInteger('year') ?? defaultYear;

			const leaderboardWrapper = new LeaderboardWrapper();
			const leaderboard = await leaderboardWrapper.getLeaderboard({
				guildId,
				seasonYear: year,
				timeFrame: LeaderboardControllerGetLeaderboardV1TimeFrameEnum.Seasonal,
			});

			if (!leaderboard || _.isEmpty(leaderboard.entries)) {
				return interaction.editReply({
					content: `No leaderboard data found for the ${year} season.`,
				});
			}

			const thumbnail = interaction.guild?.iconURL({ extension: 'png' });
			const parsedLeaderboard = await this.parseLeaderboardData(leaderboard);

			const embed = await this.createLeaderboardEmbed({
				leaderboardData: parsedLeaderboard,
				type: 'seasonal',
				title: `Season ${year}`,
				metadata: { thumbnail },
			});

			const pagination = new Pagination();
			const components = pagination.createPaginationButtons(
				1,
				Math.ceil(parsedLeaderboard.length / 20),
			);

			const reply = await interaction.editReply({
				embeds: [embed],
				components,
			});

			await this.handlePagination(interaction, reply, parsedLeaderboard);
		} catch (error) {
			this.container.logger.error(error);
			return interaction.editReply({
				content: 'An error occurred while fetching the seasonal leaderboard.',
			});
		}
	}

	private async handleAllTimeLeaderboard(
		interaction: Command.ChatInputCommandInteraction,
	) {
		try {
			const guildId = interaction.guildId;

			await interaction.editReply({
				content: 'Fetching leaderboard data...',
			});

			const leaderboardWrapper = new LeaderboardWrapper();
			const leaderboard = await leaderboardWrapper.getLeaderboard({
				guildId,
				timeFrame: LeaderboardControllerGetLeaderboardV1TimeFrameEnum.AllTime,
			});

			if (!leaderboard || _.isEmpty(leaderboard.entries)) {
				return interaction.editReply({
					content: 'No all-time leaderboard data found.',
				});
			}

			await this.container.logger.info({
				leaderboardEntries: leaderboard.entries.length,
			});

			await interaction.editReply({
				content: 'Processing leaderboard data...',
			});

			const thumbnail = interaction.guild?.iconURL({ extension: 'png' });
			const parsedLeaderboard = await this.parseLeaderboardData(leaderboard);

			const embed = await this.createLeaderboardEmbed({
				leaderboardData: parsedLeaderboard,
				type: 'allTime',
				currentPage: 1,
				metadata: { thumbnail },
			});

			const pagination = new Pagination();
			const components = pagination.createPaginationButtons(
				1,
				Math.ceil(parsedLeaderboard.length / 20),
			);

			const reply = await interaction.editReply({
				content: null,
				embeds: [embed],
				components,
			});

			await this.handlePagination(interaction, reply, parsedLeaderboard);
		} catch (error) {
			if (error instanceof EmptyDataException) {
				return interaction.editReply({
					content: error.message,
				});
			}
			this.container.logger.error(error);
			return interaction.editReply({
				content: 'An error occurred while fetching the all-time leaderboard.',
			});
		}
	}

	private parseLeaderboardData(
		leaderboardData: LeaderboardResponseDto,
	): ParsedLeaderboardEntry[] {
		if (!leaderboardData.entries || leaderboardData.entries.length === 0) {
			return [];
		}

		const groupedByUser = _.groupBy(leaderboardData.entries, 'user_id');

		const parsedData = Object.values(groupedByUser).map((userEntries) => {
			return userEntries.reduce(
				(acc, entry) => ({
					userId: entry.user_id,
					score: acc.score + entry.score,
					correctPredictions:
						acc.correctPredictions + entry.correct_predictions,
					incorrectPredictions:
						acc.incorrectPredictions + entry.incorrect_predictions,
				}),
				{
					userId: userEntries[0].user_id,
					score: 0,
					correctPredictions: 0,
					incorrectPredictions: 0,
				},
			);
		});

		const sortedData = parsedData.sort((a, b) => b.score - a.score);
		return sortedData.map((entry, index) => ({
			...entry,
			position: index + 1,
		}));
	}

	async createLeaderboardEmbed(
		params: CreateLeaderboardEmbedParams,
	): Promise<EmbedBuilder> {
		if (
			!params.leaderboardData ||
			params.leaderboardData.length === 0 ||
			_.isEmpty(params.leaderboardData)
		) {
			throw new EmptyDataException(`the ${params.type} leaderboard`);
		}

		const currentPage = params.currentPage || 1;
		const startIndex = (currentPage - 1) * 20;
		const endIndex = startIndex + 20;
		const pageEntries = params.leaderboardData.slice(startIndex, endIndex);
		const totalPages = Math.ceil(params.leaderboardData.length / 20);

		// Process user data in parallel with proper error handling
		const descriptionLines = await Promise.all(
			pageEntries.map(async (entry) => {
				try {
					const member = await this.getMember(entry.userId);
					const username = member ? member.username : entry.userId;
					const total = entry.correctPredictions + entry.incorrectPredictions;
					return `${entry.position}. ${username} - **\`${entry.score}\`** *(${entry.correctPredictions}/${total})*`;
				} catch (error) {
					this.container.logger.error(
						`Error processing user ${entry.userId}:`,
						error,
					);
					return `${entry.position}. Unknown User - **\`${entry.score}\`** *(${entry.correctPredictions}/${entry.correctPredictions + entry.incorrectPredictions})*`;
				}
			}),
		);

		const embed = new EmbedBuilder()
			.setTitle(
				`${await this.parseLeaderboardTitle(params.type)} Leaderboard ${params?.title ? `| ${params.title}` : ''}`,
			)
			.setColor(embedColors.PlutoBlue)
			.setDescription(descriptionLines.join('\n'))
			.setFooter({
				text: `Page ${currentPage} of ${totalPages} | Total Entries: ${params.leaderboardData.length}`,
			});

		if (params.metadata?.thumbnail) {
			embed.setThumbnail(params.metadata.thumbnail);
		}

		return embed;
	}

	private async parseLeaderboardTitle(
		type: 'weekly' | 'monthly' | 'seasonal' | 'allTime',
	) {
		return type.charAt(0).toUpperCase() + type.slice(1);
	}

	private async getMember(userId: string) {
		try {
			return await new ClientTools(this.container).resolveMember(userId);
		} catch (error) {
			this.container.logger.error(`Failed to resolve member ${userId}:`, error);
			return null;
		}
	}

	private async handlePagination(
		interaction: Command.ChatInputCommandInteraction,
		reply: Message,
		leaderboard: ParsedLeaderboardEntry[],
	) {
		const totalPages = Math.ceil(leaderboard.length / 20);
		let currentPage = 1;

		const collector = reply.createMessageComponentCollector({ time: 60000 });

		collector.on('collect', async (i) => {
			if (i.user.id !== interaction.user.id) {
				await i.followUp({
					content: 'Only the original user can interact with these buttons.',
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

			const newEmbed = await this.createLeaderboardEmbed({
				leaderboardData: leaderboard,
				currentPage,
				type: 'weekly',
			});
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

class CreateLeaderboardEmbedParams {
	leaderboardData: ParsedLeaderboardEntry[];
	currentPage?: number = 1;
	title?: string;
	type: 'weekly' | 'monthly' | 'seasonal' | 'allTime';
	metadata?: {
		thumbnail?: string;
		currentWeek?: number;
	};
}

class EmptyDataException extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'EmptyDataException';
		this.message = `No data found for ${message}.`;
	}
}
