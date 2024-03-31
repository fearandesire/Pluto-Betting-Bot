import BetslipWrapper from './betslip-wrapper.js'
import { PlacedBetslip } from '@khronos-index'
import { CommandInteraction, EmbedBuilder, Guild } from 'discord.js'
import embedColors from '../../../../lib/colorsConfig.js'
import { helpfooter } from '@pluto-core-config'

export default class BetslipDataManager {
	constructor(private betslipWrapper: BetslipWrapper) {}

	async getActiveBets(interaction: CommandInteraction, userId: string) {
		const activeBets = await this.betslipWrapper.activeBetsForUser({
			userid: userId,
		})
		const guild = interaction.guild
		if (!guild) {
			throw new Error(`Guild not identified from interaction.`)
		}
		return this.displayUsersBets(guild, activeBets)
	}

	async displayUsersBets(guild: Guild, bets: PlacedBetslip[]) {
		const embed = new EmbedBuilder()
			.setTitle('🎲 Active Bets')
			.setColor(embedColors.PlutoYellow) // Set a color for the embed
			.setFooter({ text: helpfooter })

		if (bets.length === 0) {
			embed.setDescription('No active bets found.')
			embed.setColor(embedColors.PlutoRed)
			return embed
		}

		// For each bet, add a field to the embed
		bets.forEach((bet) => {
			const teamEmoji = guild.emojis.cache.find(
				(emoji) => emoji.name === bet.team,
			)
			// Extract the short name of the team
			const teamShortName = bet.team.split(' ').pop() ?? bet.team
			const chosenTeamStr = teamEmoji
				? `${teamEmoji} ${teamShortName}`
				: teamShortName

			// Construct the bet description
			const description = [
				`**Match Date:** ${bet.dateofmatchup}`,
				`**Team:** ${chosenTeamStr}`,
				`**Amount:** $${bet.amount}`,
				`**Potential Profit:** ${bet.profit}`,
				`**Potential Payout:** ${bet.payout}`,
			].join('\n')

			// Add the description as a field in the embed, using bet id as a title for uniqueness
			embed.addFields({
				name: `Bet ID: ${bet.betid}`,
				value: description,
				inline: false,
			})
		})

		return embed
	}
}
