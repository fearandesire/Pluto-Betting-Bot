import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { EmbedBuilder, type Message } from 'discord.js';
import _ from 'lodash';
import embedColors from '../../lib/colorsConfig.js';
import type { SimpleLeaderboardResponseDto } from '../../openapi/khronos/models/index.js';
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
					.setContexts([0]),
			{
				idHints: ['1297933995123933225'],
			},
		);
	}

	public override async chatInputRun(
		interaction: Command.ChatInputCommandInteraction,
	) {
		await interaction.deferReply();

		try {
			const guildId = interaction.guildId;

			await interaction.editReply({
				content: 'Fetching leaderboard data...',
			});

			const leaderboardWrapper = new LeaderboardWrapper();
			const leaderboard = await leaderboardWrapper.getLeaderboard({
				guildId,
			});

			if (!leaderboard || _.isEmpty(leaderboard.entries)) {
				return interaction.editReply({
					content: 'No leaderboard data found.',
				});
			}

			await this.container.logger.info({
				leaderboardEntries: leaderboard.entries.length,
			});

			await interaction.editReply({
				content: 'Processing leaderboard data...',
			});

			const thumbnail = interaction.guild?.iconURL({ extension: 'png' });
			const parsedLeaderboard = this.parseLeaderboardData(leaderboard);

			const embed = await this.createLeaderboardEmbed({
				leaderboardData: parsedLeaderboard,
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
				content: 'An error occurred while fetching the leaderboard.',
			});
		}
	}

	private parseLeaderboardData(
		leaderboardData: SimpleLeaderboardResponseDto,
	): ParsedLeaderboardEntry[] {
		if (!leaderboardData.entries || leaderboardData.entries.length === 0) {
			return [];
		}

		// Entries are already aggregated and sorted by the backend
		// Calculate score using the formula: (correct * 10) + (incorrect * -2)
		// Default values from ScoringService as per prediction-system.md
		const CORRECT_POINTS = 10;
		const INCORRECT_PENALTY = -2;

		return leaderboardData.entries.map((entry, index) => {
			const score =
				entry.correct_predictions * CORRECT_POINTS +
				entry.incorrect_predictions * INCORRECT_PENALTY;

			return {
				userId: entry.user_id,
				score,
				correctPredictions: entry.correct_predictions,
				incorrectPredictions: entry.incorrect_predictions,
				position: index + 1,
			};
		});
	}

	async createLeaderboardEmbed(
		params: CreateLeaderboardEmbedParams,
	): Promise<EmbedBuilder> {
		if (
			!params.leaderboardData ||
			params.leaderboardData.length === 0 ||
			_.isEmpty(params.leaderboardData)
		) {
			throw new EmptyDataException('the leaderboard');
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
				`Accuracy Leaderboard${params?.title ? ` | ${params.title}` : ''}`,
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
	metadata?: {
		thumbnail?: string;
	};
}

class EmptyDataException extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'EmptyDataException';
		this.message = `No data found for ${message}.`;
	}
}
