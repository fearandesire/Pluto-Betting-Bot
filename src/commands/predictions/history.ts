import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { ButtonBuilder, EmbedBuilder, type Message } from 'discord.js';
import PredictionApiWrapper from '../../utils/api/Khronos/prediction/predictionApiWrapper.js';
import Pagination from '../../utils/embeds/pagination.js';
import embedColors from '../../lib/colorsConfig.js';
import {
	GetAllPredictionsFilteredStatusEnum,
	type AllUserPredictionsDto,
} from '../../openapi/khronos/index.js';
import type { User } from 'discord.js';
import TeamInfo from '../../utils/common/TeamInfo.js';
import PropsApiWrapper from '../../utils/api/Khronos/props/propsApiWrapper.js';
import { MarketKeyAbbreviations } from '../../utils/api/common/interfaces/market-abbreviations.js';
import _ from 'lodash';
import { DateManager } from '../../utils/common/DateManager.js';
import {
	PaginatedFieldMessageEmbed,
	PaginatedMessage,
	PaginatedMessageEmbedFields,
} from '@sapphire/discord.js-utilities';

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
								'[Optional] The user to view history for (default: yourself)',
							)
							.setRequired(false),
					)
					.addStringOption((option) =>
						option
							.setName('status')
							.setDescription('[Optional] Filter predictions by status')
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
			{ idHints: ['1298280482123026536'] },
		);
	}

	public override async chatInputRun(
		interaction: Command.ChatInputCommandInteraction,
	) {
		await interaction.deferReply();

		const user = interaction.options.getUser('user') || interaction.user;
		const status = interaction.options.getString(
			'status',
		) as GetAllPredictionsFilteredStatusEnum | null;

		if (!user) {
			return interaction.editReply({
				content: 'Invalid user specified.',
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
				return interaction.editReply({
					content: 'No predictions found for the specified criteria.',
				});
			}
			const descStr = status ? `Filtered by: \`${status}\`` : null;
			const templateEmbed = new EmbedBuilder()
				.setTitle(`Prediction History | ${user.username}`)
				.setDescription(descStr)
				.setColor(embedColors.PlutoBlue);

			const formattedPredictions = await Promise.all(
				usersPredictions.map((prediction) =>
					this.createPredictionField(prediction),
				),
			);

			const paginatedMsg = new PaginatedMessageEmbedFields({
				template: { embeds: [templateEmbed] },
			})
				.setItems(formattedPredictions)
				.setItemsPerPage(10)
				.make();

			await paginatedMsg.run(interaction);
		} catch (error) {
			this.container.logger.error(error);
			return interaction.editReply({
				content: 'An error occurred while fetching the prediction history.',
			});
		}
	}

	private async createHistoryEmbed(
		predictions: AllUserPredictionsDto[],
		user: User,
		currentPage: number,
		status: GetAllPredictionsFilteredStatusEnum | null,
	): Promise<EmbedBuilder> {
		const startIndex = (currentPage - 1) * 10;
		const endIndex = startIndex + 10;
		const pageEntries = predictions.slice(startIndex, endIndex);
		const totalPages = Math.ceil(predictions.length / 10);

		const embed = new EmbedBuilder()
			.setTitle(`Prediction History for ${user.username}`)
			.setColor(embedColors.PlutoBlue)
			.setFooter({ text: `Page ${currentPage} of ${totalPages}` });

		const totalPredictions = predictions.length;
		let headerText = `Total predictions: \`${totalPredictions}\``;
		if (status) {
			headerText += ` | Filtered by: \`${status}\``;
		}

		embed.setDescription(headerText);

		for (const prediction of pageEntries) {
			const field = await this.createPredictionField(prediction);
			embed.addFields(field);
		}

		return embed;
	}

	private async createPredictionField(
		prediction: AllUserPredictionsDto,
	): Promise<{ name: string; value: string; inline: boolean }> {
		const outcomeEmoji = this.getOutcomeEmoji(prediction);
		const parsedMatchString = await this.parseMatchString(
			prediction.match_string,
		);
		const parsedChoice = this.parseChoice(prediction.choice);
		// Get Prop via ID within the prediction
		const propApiWrapper = new PropsApiWrapper();
		const prop = await propApiWrapper.getPropById(prediction.prop_id);
		// type of prop
		const { market_key, point } = prop;
		let parsedMarketKey = MarketKeyAbbreviations[market_key] || market_key;
		parsedMarketKey = _.startCase(parsedMarketKey);
		const outcomeStr = (emoji: string) => {
			if (emoji === '⏳') {
				return 'Pending ⏳';
			}
			if (emoji === '✅') {
				return 'Correct ✅';
			}
			if (emoji === '❌') {
				return 'Incorrect ❌';
			}
			return emoji;
		};
		const date = new DateManager().toMMDDYYYY(prediction.created_at);
		let value = `**Date**: ${date}\n**Status**: ${outcomeStr(outcomeEmoji)}\n**Choice**: \`${parsedChoice} ${point ? `${point}` : ''}\`\n**Market**: ${parsedMarketKey} `;

		if (prediction.description && prediction.description.trim() !== '') {
			value += `\n**Player:** ${prediction.description}`;
		}

		return {
			name: `${parsedMatchString}`,
			value: value,
			inline: false,
		};
	}

	private getOutcomeEmoji(prediction: AllUserPredictionsDto): string {
		if (prediction.status !== GetAllPredictionsFilteredStatusEnum.Completed) {
			return '⏳';
		}
		if (prediction.is_correct === null) {
			return '⏳';
		}
		return prediction?.is_correct ? '✅' : '❌';
	}

	private async parseMatchString(matchString: string) {
		const [awayTeam, homeTeam] = matchString.split(' vs. ');
		const result = await TeamInfo.resolveTeamIdentifier({
			away_team: awayTeam,
			home_team: homeTeam,
		});

		return `${result.away_team} vs. ${result.home_team}`;
	}
	private parseChoice(choice: string) {
		return choice.charAt(0).toUpperCase() + choice.slice(1).toLowerCase();
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

			await i.deferUpdate();

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

			const newEmbed = await this.createHistoryEmbed(
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

			await interaction.editReply({
				embeds: [newEmbed],
				components: newComponents,
			});
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

			await interaction.editReply({ components: disabledComponents });
		});
	}
}
