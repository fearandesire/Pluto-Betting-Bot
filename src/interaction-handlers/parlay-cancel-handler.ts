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

type ParlayCancelPayload =
	| { kind: 'cancel'; parlayId: string; cancellationPage: number }
	| {
			kind: 'navigate'
			action: 'first' | 'prev' | 'next' | 'last'
			currentPage: number
	  }

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

const parsePage = (value: string): number | undefined => {
	if (!/^\d+$/.test(value)) return undefined
	const page = Number(value)
	return Number.isSafeInteger(page) && page > 0 ? page : undefined
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
		const payload = interaction.customId.slice(parlayCancelPrefix.length)

		if (payload.startsWith('nav_')) {
			const [, action, pageValue] = payload.split('_')
			if (
				(action !== 'first' &&
					action !== 'prev' &&
					action !== 'next' &&
					action !== 'last') ||
				!pageValue
			) {
				return this.none()
			}
			const currentPage = parsePage(pageValue)
			if (!currentPage) return this.none()
			await interaction.deferUpdate()
			return this.some({ kind: 'navigate', action, currentPage })
		}

		const separator = payload.lastIndexOf('_')
		const pageValue = payload.slice(separator + 1)
		const cancellationPage = parsePage(pageValue) ?? 1
		const encodedId = parsePage(pageValue)
			? payload.slice(0, separator)
			: payload
		let parlayId: string
		try {
			parlayId = decodeURIComponent(encodedId)
		} catch {
			return this.none()
		}
		if (!parlayId) return this.none()

		await interaction.deferUpdate()
		return this.some({ kind: 'cancel', parlayId, cancellationPage })
	}

	private async render(
		interaction: ButtonInteraction,
		cancellationPage = 1,
	): Promise<void> {
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
			parlayFetchWarning: betsData.parlayFetchWarning,
			cancellationPage,
		}
		await interaction.editReply(
			await this.formatterService.buildEmbedResponse(
				displayData,
				interaction.guild ?? undefined,
			),
		)
	}

	public async run(
		interaction: ButtonInteraction,
		payload: ParlayCancelPayload,
	) {
		try {
			if (payload.kind === 'navigate') {
				let targetPage: number
				switch (payload.action) {
					case 'first':
						targetPage = 1
						break
					case 'prev':
						targetPage = Math.max(1, payload.currentPage - 1)
						break
					case 'next':
						targetPage = payload.currentPage + 1
						break
					case 'last':
						targetPage = Number.MAX_SAFE_INTEGER
						break
				}
				await this.render(interaction, targetPage)
				return
			}

			await this.parlayApi.cancel(payload.parlayId, interaction.user.id)
			await this.render(interaction, payload.cancellationPage)
		} catch (error) {
			this.container.logger.error({
				message:
					payload.kind === 'cancel'
						? 'Failed to cancel parlay'
						: 'Failed to navigate parlay cancellations',
				metadata: {
					userId: interaction.user.id,
					...(payload.kind === 'cancel'
						? { parlayId: payload.parlayId }
						: { action: payload.action }),
					error: getParlayErrorMessage(error),
				},
			})
			await interaction.editReply({
				content:
					payload.kind === 'cancel'
						? `Unable to cancel this parlay: ${getParlayErrorMessage(error)}`
						: 'Unable to load more cancellable parlays. Please run /mybets again.',
				components: [],
			})
		}
	}
}
