import { ApplyOptions } from '@sapphire/decorators'
import { Command } from '@sapphire/framework'
import { InteractionContextType } from 'discord.js'

import { CacheManager } from '../../utils/cache/cache-manager.js'
import { ErrorEmbeds } from '../../utils/common/errors/global.js'
import { MyBetsPaginationService } from '../../utils/api/Khronos/bets/mybets-pagination.service.js'
import { MyBetsFormatterService, type MyBetsDisplayData } from '../../utils/api/Khronos/bets/mybets-formatter.service.js'

const MYBETS_CACHE_TTL = 300 // 5 minutes

@ApplyOptions<Command.Options>({
	description: '🪙 View your pending and historical bets',
})
export class UserCommand extends Command {
	private paginationService = new MyBetsPaginationService()
	private formatterService = new MyBetsFormatterService()
	private cacheManager = new CacheManager()

	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder
				.setName(this.name)
				.setDescription(this.description)
				.setContexts(InteractionContextType.Guild),
		)
	}

	public override async chatInputRun(
		interaction: Command.ChatInputCommandInteraction,
	) {
		await interaction.deferReply()

		try {
			const userId = interaction.user.id
			const betsData = await this.paginationService.fetchUserBets(userId)

			// Cache for button navigation
			const cacheKey = `mybets:${userId}`
			await this.cacheManager.set(
				cacheKey,
				JSON.stringify(betsData),
				MYBETS_CACHE_TTL,
			)

			const historyPage = this.paginationService.getHistoryPage(
				betsData.historyBets,
				1,
			)
			const groupedBets =
				this.paginationService.groupBetsByDate(historyPage.bets)

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

			return interaction.editReply(response)
		} catch (error) {
			this.container.logger.error({
				message: 'Failed to fetch mybets',
				metadata: {
					source: this.constructor.name,
					userId: interaction.user.id,
					error: error instanceof Error ? error.message : String(error),
				},
			})

			const errEmb = await ErrorEmbeds.accountErr(
				'Unable to load your bets. Please try again later.',
			)
			return interaction.editReply({ embeds: [errEmb] })
		}
	}
}
