import {
	InteractionHandler,
	InteractionHandlerTypes,
} from '@sapphire/framework'
import { type ButtonInteraction } from 'discord.js'
import {
	type MyBetsDisplayData,
	MyBetsFormatterService,
} from '../utils/api/Khronos/bets/mybets-formatter.service.js'
import { MyBetsPaginationService } from '../utils/api/Khronos/bets/mybets-pagination.service.js'
import ParlayApiWrapper from '../utils/api/Khronos/parlays/ParlayApiWrapper.js'

const parlayCancelPrefix = 'parlay_cancel_'

const getParlayErrorMessage = (error: unknown): string => {
	const data = (error as { response?: { data?: unknown } })?.response?.data
	if (typeof data === 'object' && data !== null) {
		const message = (data as { message?: unknown }).message
		if (typeof message === 'string') return message
		if (
			Array.isArray(message) &&
			message.every((item) => typeof item === 'string')
		) {
			return message.join(', ')
		}
	}
	return error instanceof Error ? error.message : 'Unable to cancel parlay.'
}

export class ParlayCancelHandler extends InteractionHandler {
	private readonly parlayApi = new ParlayApiWrapper()
	private readonly paginationService = new MyBetsPaginationService()
	private readonly formatterService = new MyBetsFormatterService()

	public constructor(
		ctx: InteractionHandler.LoaderContext,
		options: InteractionHandler.Options,
	) {
		super(ctx, {
			...options,
			interactionHandlerType: InteractionHandlerTypes.Button,
		})
	}

	public override async parse(interaction: ButtonInteraction) {
		if (!interaction.customId.startsWith(parlayCancelPrefix))
			return this.none()
		const parlayId = interaction.customId.slice(parlayCancelPrefix.length)
		if (!parlayId) return this.none()
		await interaction.deferUpdate()
		return this.some({ parlayId })
	}

	public async run(
		interaction: ButtonInteraction,
		payload: { parlayId: string },
	) {
		try {
			await this.parlayApi.cancel(payload.parlayId, interaction.user.id)
			const betsData = await this.paginationService.fetchUserBets(
				interaction.user.id,
			)
			const historyPage = this.paginationService.getHistoryPage(
				betsData.historyBets,
				1,
				betsData.historyParlays,
			)
			const displayData: MyBetsDisplayData = {
				userId: interaction.user.id,
				pendingBets: betsData.pendingBets,
				pendingParlays: betsData.pendingParlays,
				historyParlays: betsData.historyParlays,
				historyPage,
				groupedBets: this.paginationService.groupBetsByDate(
					historyPage.bets,
				),
			}
			await interaction.editReply(
				await this.formatterService.buildEmbedResponse(
					displayData,
					interaction.guild ?? undefined,
				),
			)
		} catch (error) {
			this.container.logger.error({
				message: 'Failed to cancel parlay',
				metadata: {
					userId: interaction.user.id,
					parlayId: payload.parlayId,
					error: getParlayErrorMessage(error),
				},
			})
			await interaction.editReply({
				content: `Unable to cancel this parlay: ${getParlayErrorMessage(error)}`,
				components: [],
			})
		}
	}
}
