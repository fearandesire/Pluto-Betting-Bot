import {
	InteractionHandler,
	InteractionHandlerTypes,
} from '@sapphire/framework'
import { type ButtonInteraction } from 'discord.js'
import type { PlacedBetslip } from '@kh-openapi'
import {
	parseMyBetsNavCustomId,
	type MyBetsNavAction,
} from '../lib/interfaces/interaction-handlers/interaction-handlers.interface.js'
import {
	MyBetsFormatterService,
	type MyBetsDisplayData,
} from '../utils/api/Khronos/bets/mybets-formatter.service.js'
import { MyBetsPaginationService } from '../utils/api/Khronos/bets/mybets-pagination.service.js'
import { CacheManager } from '../utils/cache/cache-manager.js'
import { ErrorEmbeds } from '../utils/common/errors/global.js'

interface CachedBetsData {
	pendingBets: PlacedBetslip[]
	historyBets: PlacedBetslip[]
	totalPages: number
}

interface MyBetsNavPayload {
	action: MyBetsNavAction
	currentPage: number
}

export class MyBetsPaginationHandler extends InteractionHandler {
	private cacheManager: CacheManager
	private paginationService: MyBetsPaginationService
	private formatterService: MyBetsFormatterService

	public constructor(
		ctx: InteractionHandler.LoaderContext,
		options: InteractionHandler.Options,
	) {
		super(ctx, {
			...options,
			interactionHandlerType: InteractionHandlerTypes.Button,
		})
		this.cacheManager = new CacheManager()
		this.paginationService = new MyBetsPaginationService()
		this.formatterService = new MyBetsFormatterService()
	}

	public override async parse(interaction: ButtonInteraction) {
		const navPayload = parseMyBetsNavCustomId(interaction.customId)
		if (!navPayload) return this.none()

		await interaction.deferUpdate()

		return this.some(navPayload)
	}

	public async run(
		interaction: ButtonInteraction,
		payload: MyBetsNavPayload,
	) {
		const userId = interaction.user.id
		const cacheKey = `mybets:${userId}`

		try {
			// Fetch cached data or refresh
			let betsData: CachedBetsData
			const cached = await this.cacheManager.get(cacheKey)

			if (cached) {
				try {
					betsData = JSON.parse(cached)
				} catch {
					this.container.logger.warn({
						message: 'MyBets cache corrupted, refetching',
						metadata: {
							source: this.run.name,
							userId,
						},
					})
					betsData = await this.paginationService.fetchUserBets(userId)
					await this.cacheManager.set(cacheKey, JSON.stringify(betsData), 300)
				}
			} else {
				// Cache expired, refetch
				betsData = await this.paginationService.fetchUserBets(userId)
				await this.cacheManager.set(
					cacheKey,
					JSON.stringify(betsData),
					300,
				)
			}
			// Calculate target page
			let targetPage: number
			switch (payload.action) {
				case 'first':
					targetPage = 1
					break
				case 'prev':
					targetPage = Math.max(1, payload.currentPage - 1)
					break
				case 'next':
					targetPage = Math.min(
						betsData.totalPages,
						payload.currentPage + 1,
					)
					break
				case 'last':
					targetPage = betsData.totalPages
					break
				default:
					targetPage = payload.currentPage
			}

			const historyPage = this.paginationService.getHistoryPage(
				betsData.historyBets,
				targetPage,
			)
			const groupedBets = this.paginationService.groupBetsByDate(
				historyPage.bets,
			)

			const displayData: MyBetsDisplayData = {
				userId,
				pendingBets: betsData.pendingBets,
				historyPage,
				groupedBets,
			}

			const response = await this.formatterService.buildEmbedResponse(
				displayData,
				interaction.guild ?? undefined,
			)

			await interaction.editReply(response)
		} catch (error) {
			this.container.logger.error({
				message: 'MyBets pagination failed',
				metadata: {
					source: this.run.name,
					userId,
					error: error instanceof Error ? error.message : error,
				},
			})

			const errEmb = await ErrorEmbeds.internalErr(
				'Failed to navigate bet history. Please try the command again.',
			)
			await interaction.editReply({ embeds: [errEmb], components: [] })
		}
	}
}
