import type { BetslipWithAggregationDTO } from '@pluto-khronos/api-client'
import { format } from 'date-fns'
import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	EmbedBuilder,
} from 'discord.js'
import _ from 'lodash'
import { teamResolver } from 'resolve-team'
import embedColors from '../../colorsConfig.js'

/** Formatted money strings shared by the pending and confirmed bet slips. */
export type BetAmounts = { betAmount: string; payout: string; profit: string }

export function formatBetStr({ betAmount, payout, profit }: BetAmounts) {
	const b = '**'
	return `${b}${betAmount}${b} -> ${b}${payout}${b}\n${b}Profit:${b} ${b}${profit}${b}`
}

/**
 * Formats a match date for bet slips (forced Eastern Time).
 * Handles both ISO date strings and already-formatted dates.
 */
export function formatMatchDate(
	dateInput: string | undefined,
	betslip?: BetslipWithAggregationDTO,
): string {
	const userTimezone = 'America/New_York' // Force Eastern Time on Betslip
	const toEastern = (date: Date) =>
		date
			.toLocaleString('en-US', {
				timeZone: userTimezone,
				timeZoneName: 'short',
			})
			.replace(',', ' -')
			.replace(/:\d\d /, ' ')

	// Try to get commence_time from betslip.match if available
	if (betslip?.match?.commence_time) {
		return toEastern(new Date(betslip.match.commence_time))
	}

	if (dateInput) {
		try {
			if (
				dateInput.includes('T') ||
				/^\d{4}-\d{2}-\d{2}/.test(dateInput)
			) {
				const date = new Date(dateInput)
				if (dateInput.includes('T')) return toEastern(date)
				return format(date, 'M/d/y')
			}
			const parsedDate = new Date(dateInput)
			if (!isNaN(parsedDate.getTime())) {
				if (dateInput.match(/T|:|[AP]M/)) return toEastern(parsedDate)
				return format(parsedDate, 'M/d/y')
			}
		} catch {
			// If parsing fails, return as-is
		}
	}

	return dateInput || 'TBD'
}

/** A1: ephemeral "Pending Betslip" with confirm/cancel buttons. */
export function pendingBetslip(d: {
	chosenTeam: string
	opponent: string
	teamLabel: string
	date: string
	amounts: BetAmounts
	avatarUrl: string
}) {
	const embed = new EmbedBuilder()
		.setTitle('Pending Betslip')
		.setDescription(
			`## ${d.chosenTeam} *vs.* ${d.opponent}\n**${d.teamLabel}** | **${d.date}**\n${formatBetStr(d.amounts)}\n*Confirm your bet via the buttons below*`,
		)
		.setThumbnail(d.avatarUrl)
		.setColor(embedColors.PlutoYellow)
	const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder()
			.setCustomId('matchup_btn_confirm')
			.setLabel('Confirm Bet')
			.setStyle(ButtonStyle.Success),
		new ButtonBuilder()
			.setCustomId('matchup_btn_cancel')
			.setLabel('Cancel Bet')
			.setStyle(ButtonStyle.Danger),
	)
	return { embeds: [embed], components: [row] }
}

/** A2: "Bet confirmed!" (replaces A1). `footer` is the betFooter() text. */
export function betConfirmedEmbed(d: {
	betOnTeam: string
	opponent: string
	chosenTeamShort: string
	date: string
	amounts: BetAmounts
	avatarUrl: string
	betId: number
	footer: string
}) {
	return new EmbedBuilder()
		.setTitle('Bet confirmed!')
		.setDescription(
			`## ${d.betOnTeam} *vs.* ${d.opponent}\n**${d.chosenTeamShort}** | **${d.date}**\n${formatBetStr(d.amounts)}`,
		)
		.setColor(embedColors.success)
		.setThumbnail(d.avatarUrl)
		.setFooter({ text: `Bet ID: ${d.betId} | ${d.footer}` })
}

/** A6: public "placed a bet" announcement. */
export function betPlacedAnnouncementEmbed(d: {
	userId: string
	betOnTeam: string
	formattedAmount: string
	footer: string
}) {
	return new EmbedBuilder()
		.setDescription(
			`<@${d.userId}> placed a bet on **${d.betOnTeam}** for **\`${d.formattedAmount}\`**!`,
		)
		.setColor(embedColors.success)
		.setFooter({ text: d.footer })
}

/** A7: public parlay placed announcement. */
export function parlayPlacedAnnouncementEmbed(d: {
	userId: string
	parlayId: string
	legCount: number
	stake: number
	potentialPayout: number
}) {
	return new EmbedBuilder()
		.setDescription(
			`<@${d.userId}> placed a **${d.legCount}-leg parlay** for **\`$${d.stake.toFixed(2)}\`**!`,
		)
		.setColor(embedColors.success)
		.setFooter({
			text: `Potential payout: $${d.potentialPayout.toFixed(2)} • Parlay ${d.parlayId.slice(0, 8)}`,
		})
}

/** A4: pending bet slip cancelled via its button. */
export function betCanceledEmbed(avatarUrl: string) {
	return new EmbedBuilder()
		.setTitle('Bet Canceled')
		.setDescription('Your bet has been successfully cancelled.')
		.setColor(embedColors.PlutoRed)
		.setThumbnail(avatarUrl)
}

/** A8: /cancelbet success. */
export function betCancellationEmbed(betId: number, avatarUrl: string) {
	return new EmbedBuilder()
		.setTitle('Bet Cancellation :ticket:')
		.setDescription(
			`Successfully cancelled bet \`${betId}\`\nYour funds have been restored.`,
		)
		.setColor(embedColors.success)
		.setThumbnail(avatarUrl)
}

/** A9: /doubledown success. Amounts are pre-formatted USD strings. */
export function doubleDownEmbed(d: {
	amount: string
	payout: string
	profit: string
	balance: string
	avatarUrl: string
}) {
	return new EmbedBuilder()
		.setDescription(
			`## Double Down\n\n**Bet:** \`${d.amount}\` | **Payout:** \`${d.payout}\`\n**Profit:** \`${d.profit}\`\n**Balance:** \`${d.balance}\``,
		)
		.setColor(embedColors.success)
		.setThumbnail(d.avatarUrl)
}

/** C3: prediction placed confirmation. */
export function predictionPlacedEmbed(formattedPrediction: string) {
	return new EmbedBuilder()
		.setColor(embedColors.PlutoGreen)
		.setTitle('✅ Prediction Placed')
		.setDescription(
			'Your prediction has been recorded.\nView your predictions with `/predictions history`',
		)
		.addFields({
			name: '​',
			value: formattedPrediction,
			inline: false,
		})
		.setTimestamp()
}

const lastWord = (name: string) => _.last(name.split(' ')) as string

/**
 * Format prediction confirmation in compact view format matching history style
 * Player format: **⏳ Player Name** (ABBREV vs. ABBREV)\nProp Type • **PICK Line**\n*<t:TIMESTAMP:d>*
 * Team format: **⏳ Team Name**\nProp Type • **PICK Line**\n*<t:TIMESTAMP:d>*
 */
export async function formatPredictionConfirmation(
	outcome: {
		name: string
		description?: string
		point?: number | null
	},
	marketKey: string,
	eventContext: {
		home_team: string
		away_team: string
		commence_time: string
	},
): Promise<string> {
	const isPlayerPrediction =
		outcome.description && outcome.description.trim() !== ''

	let entityLine: string
	if (isPlayerPrediction) {
		const playerName = outcome.description!
		const awayTeamData = await teamResolver.resolve(
			eventContext.away_team,
			{ full: true },
		)
		const homeTeamData = await teamResolver.resolve(
			eventContext.home_team,
			{ full: true },
		)
		const awayAbbrev =
			awayTeamData?.abbrev || lastWord(eventContext.away_team)
		const homeAbbrev =
			homeTeamData?.abbrev || lastWord(eventContext.home_team)
		entityLine = `**⏳ ${playerName}** (${awayAbbrev} vs. ${homeAbbrev})`
	} else {
		// Handle spreads market - choice is team name
		entityLine = `**⏳ ${lastWord(outcome.name)}**`
	}

	const propType = _.startCase(
		marketKey.replace('player_', '').replace('_', ' '),
	)

	const pick = outcome.name.toUpperCase()
	const line =
		outcome.point !== null && outcome.point !== undefined
			? outcome.point.toString()
			: ''

	const timestamp = Math.floor(
		new Date(eventContext.commence_time).getTime() / 1000,
	)
	const formattedDate = `<t:${timestamp}:d>`

	const propLine = line
		? `${propType} • **${pick} ${line}**`
		: `${propType} • **${pick}**`

	return `${entityLine}\n${propLine}\n*${formattedDate}*`
}
