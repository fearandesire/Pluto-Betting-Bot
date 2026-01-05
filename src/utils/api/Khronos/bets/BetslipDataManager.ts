import type { PlacedBetslip } from '@kh-openapi'
import { helpfooter } from '@pluto-config'
import { type CommandInteraction, EmbedBuilder, type Guild } from 'discord.js'
import embedColors from '../../../../lib/colorsConfig.js'
import type BetslipWrapper from './betslip-wrapper.js'

export default class BetslipDataManager {
	constructor(private betslipWrapper: BetslipWrapper) {}

	private formatDate(isoDate: string): string {
		const date = new Date(isoDate)
		return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`
	}

	async getActiveBets(interaction: CommandInteraction, userId: string) {
		const activeBets = await this.betslipWrapper.activeBetsForUser({
			userid: userId,
		})
		const guild = interaction.guild
		if (!guild) {
			throw new Error('Guild not identified from interaction.')
		}
		return this.displayUsersBets(guild, activeBets)
	}

	/**
	 * Displays the user's active bets in an embed
	 * @param guild - The guild the bets are from
	 * @param bets - The bets to display
	 * @returns An embed containing the user's active bets
	 */
	async displayUsersBets(guild: Guild, bets: PlacedBetslip[]) {
		const embed = new EmbedBuilder()
			.setTitle('🎲 Active Bets')
			.setColor(embedColors.PlutoYellow)

		if (bets.length === 0) {
			embed
				.setDescription('No active bets found.')
				.setColor(embedColors.PlutoRed)
			return embed
		}

		for (const bet of bets) {
			const teamEmoji =
				guild.emojis.cache.find((emoji) => emoji.name === bet.team) ||
				''
			const teamShortName = bet.team.split(' ').pop() ?? bet.team
			const chosenTeamStr = `${teamEmoji} ${teamShortName}`
			// Parse to numbers
			const amount = Number(bet.amount).toFixed(2)
			const profit = Number(bet.profit).toFixed(2)
			const payout = Number(bet.payout).toFixed(2)

			const description =
				`**Team:** ${chosenTeamStr}\n` +
				`**Amount:** \`$${amount}\`\n` +
				`**Profit:** \`$${profit}\`\n` +
				`**Payout:** \`$${payout}\`\n` +
				`**Date Placed:** ${this.formatDate(bet.dateofbet)}`

			embed.addFields({
				name: `**ID:** \`${bet.betid}\``,
				value: description,
				inline: true,
			})
		}

		return embed
	}
}
