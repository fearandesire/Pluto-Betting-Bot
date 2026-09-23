import type { OverallStatsDto } from '@pluto-khronos/api-client'
import { Colors, EmbedBuilder } from 'discord.js'
import embedColors from '../../colorsConfig.js'

type SuccessData = {
	title: string
	description: string
	footer: string
	/** Invoker's avatar (`interaction.user.displayAvatarURL()`). */
	thumbnail: string
}

/** Classic success embed behind `EmbedsSuccess.sv1` (D1 /balance, D2 /dailyclaim). */
export function successEmbed(data: SuccessData) {
	return new EmbedBuilder()
		.setTitle(data.title)
		.setDescription(data.description)
		.setColor(embedColors.success)
		.setFooter({ text: data.footer })
		.setThumbnail(data.thumbnail)
}

/** D1 profile body. `balance` is already USD-formatted. */
export function profileDescription(p: {
	balance: string
	level: number
	tier: string
	welcome?: string
}) {
	const body = `💰 **Balance:** \`${p.balance}\`\n🛡️ **Level:** \`${p.level}\`\n💫 **Tier:** \`${p.tier}\``
	return p.welcome ? `${p.welcome}\n\n${body}` : body
}

/** D3 /register. */
export function accountCreatedEmbed(balance: number, thumbnail: string) {
	return new EmbedBuilder()
		.setTitle('Account Created')
		.setDescription(
			`Your account has been created! You will start off with a balance of $${balance}.\nIf you run out of money, you can get get more by claiming daily rewards from the \`/dailyclaim\` command.`,
		)
		.setColor(embedColors.PlutoGreen)
		.setThumbnail(thumbnail)
}

export type LeaderboardEntry = { memberTag: string; balance: string }

/** D4 /leaderboard: one page of the reaction-paged leaderboard. */
export function leaderboardPageEmbed(
	pageData: LeaderboardEntry[],
	page: number,
	pagesTotal: number,
	perPage: number,
) {
	const description =
		pageData
			.map((entry, index) => {
				const position = (page - 1) * perPage + index + 1
				return `**${position}.** ${entry.memberTag}: **\`$${entry.balance}\`**`
			})
			.join('\n') || 'No entries to display.'
	return new EmbedBuilder()
		.setTitle(`Leaderboard | Page ${page} of ${pagesTotal}`)
		.setDescription(description)
		.setColor(0xffac33)
		.setFooter({ text: `Page ${page} of ${pagesTotal}` })
}

/** D5 /stats h2h view: plain embed object (not an EmbedBuilder). */
export function h2hStatsEmbed(
	username: string,
	s: OverallStatsDto,
	footer: string,
) {
	const formatValue = (value: number) =>
		value === 0 ? 'N/A' : `$${value.toLocaleString()}`
	const formatCount = (value: number) =>
		value === 0 ? 'N/A' : value.toLocaleString()
	const formatPercentage = (value: number) =>
		value === 0 ? 'N/A' : `${value.toFixed(1)}%`

	return {
		color: Colors.Blue,
		title: `🎲 ${username}'s Betting Stats`,
		fields: [
			{
				name: '📊 Totals',
				value: [
					`Bets: **${formatCount(s.totalBets)}**`,
					`Wins: **${formatCount(s.totalWins)}**`,
					`Losses: **${formatCount(s.totalLosses)}**`,
					`Win Rate: **${formatPercentage(s.winRate)}**`,
					`Highest Bet: **${formatValue(s.highestBetAmount)}** 💰`,
				].join('\n'),
				inline: false,
			},
			{
				name: '🏆 Most Bet Team',
				value:
					s.mostBetTeam.count === 0
						? 'N/A'
						: `Team: **${s.mostBetTeam.team}**\nBets: **${s.mostBetTeam.count}**`,
				inline: true,
			},
			{
				name: '😅 Most Losses Team',
				value:
					s.mostLossesTeam.losses === 0
						? 'N/A'
						: `Team: **${s.mostLossesTeam.team}**\nLosses: **${s.mostLossesTeam.losses}**`,
				inline: true,
			},
			{
				name: '💵 Profit/Loss Summary',
				value: [
					`Total Profit: **${formatValue(s.profitLossSummary.totalWon)}**`,
					`Total Loss: **${formatValue(s.profitLossSummary.totalLost)}**`,
					`Net Profit: **${formatValue(s.profitLossSummary.netProfit)}**`,
				].join('\n'),
				inline: false,
			},
		],
		timestamp: new Date().toISOString(),
		footer: { text: footer },
	}
}

/** D5 empty state. */
export function h2hNoStatsEmbed(footer: string) {
	return {
		color: Colors.Red,
		title: '❌ No Betting Stats Available',
		description:
			"You don't have enough betting history to display statistics.",
		footer: { text: footer },
	}
}

/** D6 welcome DM. `message` is `plutoWelcomeMsg`. */
export function welcomeEmbed(message: string) {
	return new EmbedBuilder()
		.setTitle('Welcome to Pluto! 🎉')
		.setDescription(message)
		.setColor(0x5865f2)
		.setTimestamp()
}
