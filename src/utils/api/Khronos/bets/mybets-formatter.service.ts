import type { PlacedBetslip } from '@kh-openapi'
import { helpfooter } from '@pluto-config'
import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	ContainerBuilder,
	EmbedBuilder,
	type Guild,
	type InteractionEditReplyOptions,
	MessageFlags,
	SeparatorSpacingSize,
} from 'discord.js'
import embedColors from '../../../../lib/colorsConfig.js'
import {
	buildMyBetsNavCustomId,
	mybetsNavPageId,
} from '../../../../lib/interfaces/interaction-handlers/interaction-handlers.interface.js'
import { PlacedBetslipBetresultEnum } from '../../../../openapi/khronos/index.js'
import type { BetsByDate, HistoryPage } from './mybets-pagination.service.js'

export interface MyBetsDisplayData {
	userId: string
	pendingBets: PlacedBetslip[]
	historyPage: HistoryPage
	groupedBets: BetsByDate[]
}

export class MyBetsFormatterService {
	private formatMoney(amount: number | null): string {
		if (amount === null) return 'N/A'
		return `$${Number(amount).toFixed(2)}`
	}

	private formatDate(dateStr: string | null): string {
		if (!dateStr) return 'Unknown'
		const date = new Date(dateStr)
		if (isNaN(date.getTime())) return 'Unknown'
		const timestamp = Math.floor(date.getTime() / 1000)
		return `<t:${timestamp}:d>`
	}
	private getBetResultEmoji(result: PlacedBetslipBetresultEnum): string {
		switch (result) {
			case PlacedBetslipBetresultEnum.Won:
				return '✅'
			case PlacedBetslipBetresultEnum.Lost:
				return '❌'
			case PlacedBetslipBetresultEnum.Push:
				return '🔄'
			case PlacedBetslipBetresultEnum.Pending:
				return '⏳'
			default:
				return '❓'
		}
	}

	private getBetResultColor(result: PlacedBetslipBetresultEnum): number {
		switch (result) {
			case PlacedBetslipBetresultEnum.Won:
				return 0x57f287
			case PlacedBetslipBetresultEnum.Lost:
				return 0xaa2d2d
			case PlacedBetslipBetresultEnum.Push:
				return 0x95a5a6
			default:
				return 0xd8b21a
		}
	}

	private formatTeamName(team: string, guild?: Guild): string {
		const teamEmoji = guild?.emojis.cache.find((e) => e.name === team) || ''
		const shortName = team.split(' ').pop() ?? team
		return `${teamEmoji} ${shortName}`.trim()
	}

	formatPendingBetLine(bet: PlacedBetslip, guild?: Guild): string {
		const team = this.formatTeamName(bet.team ?? 'Unknown', guild)
		const amount = this.formatMoney(bet.amount)
		const payout = this.formatMoney(bet.payout)
		const date = this.formatDate(bet.dateofbet)

		return `**⏳ ${team}**\nWager: \`${amount}\` • Payout: \`${payout}\`\n*Placed: ${date}* • ID: \`${bet.betid}\``
	}

	formatHistoryBetLine(bet: PlacedBetslip, guild?: Guild): string {
		const emoji = this.getBetResultEmoji(bet.betresult)
		const team = this.formatTeamName(bet.team ?? 'Unknown', guild)
		const amount = this.formatMoney(bet.amount)
		const payout = this.formatMoney(bet.payout)
		const profit = this.formatMoney(bet.profit)
		const date = this.formatDate(bet.dateofbet)

		let resultText: string
		switch (bet.betresult) {
			case PlacedBetslipBetresultEnum.Won:
				resultText = `Won \`${payout}\` (+\`${profit}\`)`
				break
			case PlacedBetslipBetresultEnum.Lost:
				resultText = `Lost \`${amount}\``
				break
			case PlacedBetslipBetresultEnum.Push:
				resultText = `Push (refunded \`${amount}\`)`
				break
			default:
				resultText = 'Pending'
		}

		return `**${emoji} ${team}**\nWager: \`${amount}\` • ${resultText}\n*${date}*`
	}

	async buildPendingEmbed(
		pendingBets: PlacedBetslip[],
		guild?: Guild,
	): Promise<EmbedBuilder> {
		const embed = new EmbedBuilder()
			.setTitle('⏳ Pending Bets')
			.setColor(embedColors.PlutoYellow)
			.setFooter({ text: await helpfooter('betting') })

		if (pendingBets.length === 0) {
			embed.setDescription('You have no pending bets.')
			return embed
		}

		const lines = pendingBets.map((bet) =>
			this.formatPendingBetLine(bet, guild),
		)
		embed.setDescription(lines.join('\n\n'))
		return embed
	}

	async buildHistoryEmbed(
		historyPage: HistoryPage,
		groupedBets: BetsByDate[],
		guild?: Guild,
	): Promise<EmbedBuilder> {
		const { page, totalPages } = historyPage
		const embed = new EmbedBuilder()
			.setTitle(`📜 Bet History`)
			.setColor(embedColors.PlutoBlue)
			.setFooter({
				text: `Page ${page}/${totalPages} • ${await helpfooter('betting')}`,
			})

		if (historyPage.bets.length === 0) {
			embed.setDescription(
				'No bet history found. Place some bets to see them here!',
			)
			return embed
		}

		const lines: string[] = []
		for (const group of groupedBets) {
			lines.push(`**${group.date}**`)
			for (const bet of group.bets) {
				lines.push(this.formatHistoryBetLine(bet, guild))
			}
		}

		embed.setDescription(lines.join('\n\n'))
		return embed
	}

	buildPaginationButtons(
		currentPage: number,
		totalPages: number,
	): ActionRowBuilder<ButtonBuilder> {
		const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
			new ButtonBuilder()
				.setCustomId(buildMyBetsNavCustomId('first', currentPage))
				.setLabel('⏮')
				.setStyle(ButtonStyle.Secondary)
				.setDisabled(currentPage <= 1),
			new ButtonBuilder()
				.setCustomId(buildMyBetsNavCustomId('prev', currentPage))
				.setLabel('◀')
				.setStyle(ButtonStyle.Primary)
				.setDisabled(currentPage <= 1),
			new ButtonBuilder()
				.setCustomId(mybetsNavPageId)
				.setLabel(`${currentPage}/${totalPages}`)
				.setStyle(ButtonStyle.Secondary)
				.setDisabled(true),
			new ButtonBuilder()
				.setCustomId(buildMyBetsNavCustomId('next', currentPage))
				.setLabel('▶')
				.setStyle(ButtonStyle.Primary)
				.setDisabled(currentPage >= totalPages),
			new ButtonBuilder()
				.setCustomId(buildMyBetsNavCustomId('last', currentPage))
				.setLabel('⏭')
				.setStyle(ButtonStyle.Secondary)
				.setDisabled(currentPage >= totalPages),
		)
		return row
	}

	async buildComponentsV2Response(
		data: MyBetsDisplayData,
		guild?: Guild,
	): Promise<InteractionEditReplyOptions> {
		const container = new ContainerBuilder().setAccentColor(
			embedColors.PlutoBlue as number,
		)

		// Pending Bets Section
		if (data.pendingBets.length > 0) {
			container.addTextDisplayComponents((text) =>
				text.setContent('## ⏳ Pending Bets'),
			)

			for (const bet of data.pendingBets) {
				container.addTextDisplayComponents((text) =>
					text.setContent(this.formatPendingBetLine(bet, guild)),
				)
			}

			container.addSeparatorComponents((sep) =>
				sep.setSpacing(SeparatorSpacingSize.Large).setDivider(true),
			)
		}

		// History Section
		container.addTextDisplayComponents((text) =>
			text.setContent(
				`## 📜 Bet History (Page ${data.historyPage.page}/${data.historyPage.totalPages})`,
			),
		)

		if (data.historyPage.bets.length === 0) {
			container.addTextDisplayComponents((text) =>
				text.setContent(
					'*No bet history found. Place some bets to see them here!*',
				),
			)
		} else {
			for (const group of data.groupedBets) {
				container.addTextDisplayComponents((text) =>
					text.setContent(`### ${group.date}`),
				)
				for (const bet of group.bets) {
					container.addTextDisplayComponents((text) =>
						text.setContent(this.formatHistoryBetLine(bet, guild)),
					)
				}
			}
		}

		// Pagination Buttons
		const paginationRow = this.buildPaginationButtons(
			data.historyPage.page,
			data.historyPage.totalPages,
		)

		container.addActionRowComponents((row) =>
			row.setComponents(paginationRow.components),
		)

		return {
			components: [container],
			flags: MessageFlags.IsComponentsV2,
		}
	}

	async buildEmbedResponse(
		data: MyBetsDisplayData,
		guild?: Guild,
	): Promise<InteractionEditReplyOptions> {
		const embeds: EmbedBuilder[] = []

		// Pending embed (always show, even if empty)
		const pendingEmbed = await this.buildPendingEmbed(
			data.pendingBets,
			guild,
		)
		embeds.push(pendingEmbed)

		// History embed
		const historyEmbed = await this.buildHistoryEmbed(
			data.historyPage,
			data.groupedBets,
			guild,
		)
		embeds.push(historyEmbed)

		// Pagination buttons (only if multiple pages)
		const components: ActionRowBuilder<ButtonBuilder>[] = []
		if (data.historyPage.totalPages > 1) {
			components.push(
				this.buildPaginationButtons(
					data.historyPage.page,
					data.historyPage.totalPages,
				),
			)
		}

		return {
			embeds,
			components,
		}
	}
}
