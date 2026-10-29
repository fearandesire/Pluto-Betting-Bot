import type { OverallStatsDto } from '@pluto-khronos/api-client'
import { Colors, EmbedBuilder } from 'discord.js'
import type {
	PropBettingStats,
	PropMarketStats,
} from '../../../utils/api/Khronos/stats/stats-wrapper.js'
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

const PROP_MARKET_LABELS: Record<string, string> = {
	player_points: 'Points',
	player_rebounds: 'Rebounds',
	player_assists: 'Assists',
}
const PROP_STATS_MAX_MARKETS = 8

/** Readable label for a prop market key; unknown keys are title-cased without `player_`. */
export function propMarketLabel(key: string): string {
	const known = PROP_MARKET_LABELS[key]
	if (known) return known
	return (
		key
			.replace(/^player_/, '')
			.split('_')
			.filter(Boolean)
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
			.join(' ') || key
	)
}

const formatRecord = (
	m: Pick<PropMarketStats, 'correct' | 'incorrect' | 'pushes'>,
) => `${m.correct}-${m.incorrect}${m.pushes > 0 ? `-${m.pushes}` : ''}`
const formatHitRate = (rate: number | null) =>
	rate === null ? 'n/a' : `${rate.toFixed(1)}%`

function propMarketLine(m: PropMarketStats) {
	const parts = [
		`**${propMarketLabel(m.market_key)}**`,
		formatRecord(m),
		formatHitRate(m.hit_rate),
	]
	if (m.avg_offered_line !== null) {
		parts.push(`avg line ${m.avg_offered_line}`)
	}
	return parts.join(' · ')
}

/** /stats props: hit rate only; props are free predictions, not money bets. */
export function propStatsEmbed(
	username: string,
	s: PropBettingStats,
	footer: string,
) {
	const sport = s.sport ? ` (${s.sport.toUpperCase()})` : ''
	const shown = s.markets.slice(0, PROP_STATS_MAX_MARKETS)
	const hidden = s.markets.length - shown.length
	const overall = [
		`Record: **${formatRecord(s)}**`,
		`Hit Rate: **${formatHitRate(s.hit_rate)}**`,
		`Settled: **${s.total_settled}**`,
	]
	if (s.pending > 0) overall.push(`Pending: **${s.pending}**`)

	const fields = [
		{ name: '📊 Overall', value: overall.join('\n'), inline: false },
	]
	if (shown.length > 0) {
		const lines = shown.map(propMarketLine)
		if (hidden > 0) lines.push(`*+${hidden} more*`)
		fields.push({
			name: '🎯 By Market',
			value: lines.join('\n'),
			inline: false,
		})
	}

	return {
		color: Colors.Blue,
		title: `🎯 ${username}'s Prop Stats${sport}`,
		fields,
		timestamp: new Date().toISOString(),
		footer: { text: footer },
	}
}

/** /stats props empty state. */
export function propNoStatsEmbed(footer: string) {
	return {
		color: Colors.Red,
		title: '❌ No Prop Stats Available',
		description:
			"You haven't settled any prop predictions yet. Make a few predictions and check back after they settle.",
		footer: { text: footer },
	}
}

/** /stats props failure notice (endpoint unavailable or request failed). */
export function propStatsErrorEmbed(footer: string) {
	return {
		color: Colors.Red,
		title: '⚠️ Prop Stats Unavailable',
		description:
			'Prop stats are not available right now. Please try again later.',
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
