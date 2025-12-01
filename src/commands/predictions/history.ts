import { ApplyOptions } from '@sapphire/decorators'
import { PaginatedMessageEmbedFields } from '@sapphire/discord.js-utilities'
import { Command } from '@sapphire/framework'
import type { User } from 'discord.js'
import { EmbedBuilder, InteractionContextType } from 'discord.js'
import _ from 'lodash'
import embedColors from '../../lib/colorsConfig.js'
import {
	type AllUserPredictionsDto,
	GetAllPredictionsFilteredStatusEnum,
} from '../../openapi/khronos/index.js'
import { MarketKeyAbbreviations } from '../../utils/api/common/interfaces/market-abbreviations.js'
import PredictionApiWrapper from '../../utils/api/Khronos/prediction/predictionApiWrapper.js'
import PropsApiWrapper from '../../utils/api/Khronos/props/propsApiWrapper.js'
import { DateManager } from '../../utils/common/DateManager.js'
import TeamInfo from '../../utils/common/TeamInfo.js'

@ApplyOptions<Command.Options>({
	description: 'View your prediction history',
})
export class UserCommand extends Command {
	private readonly dateManager = new DateManager()

	public constructor(context: Command.Context, options: Command.Options) {
		super(context, {
			...options,
			description: 'View your prediction history.',
		})
	}

	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand(
			(builder) =>
				builder //
					.setName(this.name)
					.setDescription(this.description)
					.setContexts(InteractionContextType.Guild)
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
							.setDescription(
								'[Optional] Filter predictions by status',
							)
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
		)
	}

	public override async chatInputRun(
		interaction: Command.ChatInputCommandInteraction,
	) {
		await interaction.deferReply({ ephemeral: true })

		const user = interaction.options.getUser('user') || interaction.user
		const status = interaction.options.getString(
			'status',
		) as GetAllPredictionsFilteredStatusEnum | null

		try {
			const predictionApiWrapper = new PredictionApiWrapper()
			const usersPredictions = await (status
				? predictionApiWrapper.getPredictionsFiltered({
						userId: user.id,
						status,
					})
				: predictionApiWrapper.getPredictionsForUser({
						userId: user.id,
					}))

			if (!usersPredictions || usersPredictions.length === 0) {
				return interaction.editReply({
					content: 'No predictions found for the specified criteria.',
				})
			}
			const descStr = status ? `Filtered by: \`${status}\`` : null
			const templateEmbed = new EmbedBuilder()
				.setTitle(`Prediction History | ${user.username}`)
				.setDescription(descStr)
				.setColor(embedColors.PlutoBlue)

			const propsApiWrapper = new PropsApiWrapper()
			const formattedPredictions = (
				await Promise.allSettled(
					usersPredictions.map((prediction) =>
						this.createPredictionField(prediction, propsApiWrapper),
					),
				)
			).flatMap((result, index) => {
				if (result.status === 'fulfilled') {
					return result.value ? [result.value] : []
				}
				const prediction = usersPredictions[index]
				this.container.logger.error(
					`Failed to create prediction field for prediction ${prediction?.id || 'unknown'} (user: ${user.id})`,
					result.reason,
				)
				return []
			})

			const paginatedMsg = new PaginatedMessageEmbedFields({
				template: { embeds: [templateEmbed] },
			})
				.setItems(formattedPredictions)
				.setItemsPerPage(10)
				.make()

			await paginatedMsg.run(interaction)
		} catch (error) {
			this.container.logger.error(error)
			return interaction.editReply({
				content:
					'An error occurred while fetching the prediction history.',
			})
		}
	}

	private async createPredictionField(
		prediction: AllUserPredictionsDto,
		propsApiWrapper: PropsApiWrapper,
	): Promise<{ name: string; value: string; inline: boolean } | null> {
		const outcomeEmoji = this.getOutcomeEmoji(prediction)
		const parsedMatchString = await this.parseMatchString(
			prediction.match_string,
		)
		const parsedChoice = this.parseChoice(prediction.choice)
		const prop = await propsApiWrapper.getPropByUuid(
			prediction.outcome_uuid,
		)
		const outcome = prop.outcomes.find(
			(o) => o.outcome_uuid === prediction.outcome_uuid,
		)
		if (!outcome) {
			this.container.logger.warn(
				`Missing outcome for prediction ${prediction.id} (market_key: ${prop.market_key}, outcome_uuid: ${prediction.outcome_uuid})`,
			)
			return null
		}
		const { market_key } = prop
		const point = outcome.point ?? null
		let parsedMarketKey = MarketKeyAbbreviations[market_key] || market_key
		parsedMarketKey = _.startCase(parsedMarketKey)
		const outcomeStr = (emoji: string) => {
			if (emoji === '⏳') {
				return 'Pending ⏳'
			}
			if (emoji === '✅') {
				return 'Correct ✅'
			}
			if (emoji === '❌') {
				return 'Incorrect ❌'
			}
			return emoji
		}
		const date = this.dateManager.toMMDDYYYY(
			prop.event_context.commence_time,
		)
		const pointText = point ?? ''
		const formattedChoice =
			pointText === ''
				? `\`${parsedChoice}\``
				: `\`${parsedChoice} ${pointText}\``
		let value = `**Date**: ${date}\n**Status**: ${outcomeStr(outcomeEmoji)}\n**Choice**: ${formattedChoice}\n**Market**: ${parsedMarketKey} `

		if (prediction.description && prediction.description.trim() !== '') {
			value += `\n**Player:** ${prediction.description}`
		}

		return {
			name: `${parsedMatchString}`,
			value: value,
			inline: false,
		}
	}

	private getOutcomeEmoji(prediction: AllUserPredictionsDto): string {
		if (
			prediction.status !== GetAllPredictionsFilteredStatusEnum.Completed
		) {
			return '⏳'
		}
		if (prediction.is_correct === null) {
			return '⏳'
		}
		return prediction?.is_correct ? '✅' : '❌'
	}

	private async parseMatchString(matchString: string) {
		const [awayTeam, homeTeam] = matchString.split(' vs. ')
		if (!awayTeam || !homeTeam) {
			return matchString
		}
		const result = await TeamInfo.resolveTeamIdentifier({
			away_team: awayTeam,
			home_team: homeTeam,
		})

		return `${result.away_team} vs. ${result.home_team}`
	}
	private parseChoice(choice: string) {
		return choice.charAt(0).toUpperCase() + choice.slice(1).toLowerCase()
	}
}
