import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { ButtonBuilder, EmbedBuilder, type Message } from 'discord.js';
import PredictionApiWrapper from '../../utils/api/Khronos/prediction/predictionApiWrapper.js';
import Pagination from '../../utils/embeds/pagination.js';
import embedColors from '../../lib/colorsConfig.js';
import { plutoGuildId } from '../../lib/configs/constants.js';
import {
	GetAllPredictionsFilteredStatusEnum,
	type AllUserPredictionsDto,
} from '../../openapi/khronos/index.js';
import type { User } from 'discord.js';

@ApplyOptions<Command.Options>({
	description: 'View your prediction history',
})
export class UserCommand extends Command {
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand(
			(builder) =>
				builder //
					.setName(this.name)
					.setDescription(this.description)
					.setDMPermission(false)
					.addUserOption((option) =>
						option
							.setName('user')
							.setDescription(
								'The user to view history for (default: yourself)',
							)
							.setRequired(false),
					)
					.addStringOption((option) =>
						option
							.setName('status')
							.setDescription('Filter predictions by status')
							.setRequired(false)
							.addChoices(
								{
									name: 'Pending',
									value: GetAllPredictionsFilteredStatusEnum.Pending,
								},
								{
									name: 'Completed',
									value: GetAllPredictionsFilteredStatusEnum.Completed,
								},
							),
					),
			{ guildIds: [plutoGuildId] },
		);
	}

	public override async chatInputRun(
		interaction: Command.ChatInputCommandInteraction,
	) {
		const user = interaction.options.getUser('user') || interaction.user;
		const status = interaction.options.getString(
			'status',
		) as GetAllPredictionsFilteredStatusEnum | null;

		if (!user) {
			return interaction.reply({
				content: 'Invalid user specified.',
				ephemeral: true,
			});
		}

		try {
			const predictionApiWrapper = new PredictionApiWrapper();
			const usersPredictions = await predictionApiWrapper.getPredictionsForUser(
				{
					userId: user.id,
				},
			);

			if (!usersPredictions || usersPredictions.length === 0) {
				return interaction.reply({
					content: 'No predictions found for the specified criteria.',
					ephemeral: true,
				});
			}

			const parsedPredictions = this.parsePredictions(usersPredictions);
			const embed = this.createHistoryEmbed(parsedPredictions, user, 1, status);
			const pagination = new Pagination();
			const components = pagination.createPaginationButtons(
				1,
				Math.ceil(parsedPredictions.length / 10),
			);

			const reply = await interaction.reply({
				embeds: [embed],
				components,
				fetchReply: true,
			});

			this.handlePagination(
				interaction,
				reply as Message,
				parsedPredictions,
				user,
				status,
			);
		} catch (error) {
			this.container.logger.error(error);
			return interaction.reply({
				content: 'An error occurred while fetching the prediction history.',
				ephemeral: true,
			});
		}
	}

	private parsePredictions(
		propPredictions: AllUserPredictionsDto[],
	): AllUserPredictionsDto[] {
		return propPredictions;
	}

	private createHistoryEmbed(
		predictions: AllUserPredictionsDto[],
		user: User,
		currentPage: number,
		status: GetAllPredictionsFilteredStatusEnum | null,
	): EmbedBuilder {
		const startIndex = (currentPage - 1) * 10;
		const endIndex = startIndex + 10;
		const pageEntries = predictions.slice(startIndex, endIndex);
		const totalPages = Math.ceil(predictions.length / 10);

		const embed = new EmbedBuilder()
			.setTitle(`Prediction History for ${user.username}`)
			.setColor(embedColors.PlutoBlue)
			.setDescription(
				pageEntries
					.map(
						(prediction) =>
							`**Match:** ${prediction.match_string}\n` +
							`**Description:** ${prediction.description || 'N/A'}\n\n` +
							`**Choice:** ${prediction.choice}\n` +
							`**Status:** ${prediction.status}\n` +
							`**Outcome:** ${this.getPredictionOutcome(prediction)}\n\n`,
					)
					.join('---\n'),
			)
			.setFooter({ text: `Page ${currentPage} of ${totalPages}` });

		// Get count
		const totalPredictions = predictions.length;
		embed.setDescription(
			`You've placed ${totalPredictions} predictions so far!\n\n${embed.data.description}`,
		);
		if (status) {
			embed.setDescription(
				`Showing predictions filtered by status: ${status}\n\n${embed.data.description}`,
			);
		}

		return embed;
	}

	private getPredictionOutcome(prediction: AllUserPredictionsDto): string {
		return prediction.status === GetAllPredictionsFilteredStatusEnum.Completed
			? prediction.is_correct !== null
				? prediction.is_correct
					? 'Correct'
					: 'Incorrect'
				: 'Pending'
			: 'Pending';
	}

	private async handlePagination(
		interaction: Command.ChatInputCommandInteraction,
		reply: Message,
		predictions: AllUserPredictionsDto[],
		user: User,
		status: GetAllPredictionsFilteredStatusEnum | null,
	) {
		const totalPages = Math.ceil(predictions.length / 10);
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

			const newEmbed = this.createHistoryEmbed(
				predictions,
				user,
				currentPage,
				status,
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
					for (const component of row.components) {
						if (component instanceof ButtonBuilder) {
							component.setDisabled(true);
						}
					}
					return row;
				});

			await reply.edit({ components: disabledComponents });
		});
	}
}
