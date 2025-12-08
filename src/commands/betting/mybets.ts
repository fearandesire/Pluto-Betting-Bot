import { ApplyOptions } from '@sapphire/decorators'
import { Command } from '@sapphire/framework'
import { InteractionContextType } from 'discord.js'
import {
	type MyBetsDisplayData,
	MyBetsFormatterService,
} from '../../utils/api/Khronos/bets/mybets-formatter.service.js'
import { MyBetsPaginationService } from '../../utils/api/Khronos/bets/mybets-pagination.service.js'
import { ErrorEmbeds } from '../../utils/common/errors/global.js'

@ApplyOptions<Command.Options>({
	description: '🪙 View your pending and historical bets',
})
export class UserCommand extends Command {
	private paginationService = new MyBetsPaginationService()
	private formatterService = new MyBetsFormatterService()

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
		await interaction.deferReply({ ephemeral: true })

		try {
			const userId = interaction.user.id
			const betsData = await this.paginationService.fetchUserBets(userId)

			const historyPage = this.paginationService.getHistoryPage(
				betsData.historyBets,
				1,
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

			return interaction.editReply(response)
		} catch (error) {
			this.container.logger.error({
				message: 'Failed to fetch user bets',
				metadata: {
					source: this.chatInputRun.name,
					userId: interaction.user.id,
					error:
						error instanceof Error ? error.message : String(error),
				},
			})

			const errEmb = await ErrorEmbeds.accountErr(
				'Unable to load your bets. Please try again later.',
			)
			return interaction.editReply({ embeds: [errEmb] })
		}
	}
}
