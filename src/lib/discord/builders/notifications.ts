import { EmbedBuilder } from 'discord.js'
import type {
	BigWinParlayInput,
	BigWinSingleBetInput,
} from '../../../services/engagement/BigWinAnnouncementService.js'
import MoneyFormatter from '../../../utils/api/common/money-formatting/money-format.js'
import type {
	DisplayBetNotification,
	DisplayResultLost,
	DisplayResultPush,
	DisplayResultWon,
} from '../../../utils/api/routes/notifications/notifications.interface.js'
import type { ParlayResultNotification } from '../../../utils/api/routes/shared-payload-schemas.js'
import embedColors from '../../colorsConfig.js'

function formatAmericanOdds(odds: number): string {
	return odds > 0 ? `+${odds}` : `${odds}`
}

// ------------------------------------------------------------ E1 bet result DM

/** Single-bet result DM (surface E1). Undefined for an unknown outcome. */
export function betResultEmbed(
	betData: DisplayBetNotification,
): EmbedBuilder | undefined {
	const { betId, result, displayResult } = betData
	const betIdLabel =
		betId === undefined ? 'Bet ID unavailable' : `Bet ID: ${betId}`

	switch (result.outcome) {
		case 'won': {
			const {
				team,
				displayBetAmount,
				displayPayout,
				displayProfit,
				displayNewBalance,
				displayOldBalance,
			} = displayResult as DisplayResultWon

			return new EmbedBuilder()
				.setTitle('🎉 Bet Won! 🎉')
				.setColor('#57f287')
				.addFields(
					{ name: '🎯 Team Selected', value: team, inline: true },
					{
						name: '💰 Bet Amount',
						value: displayBetAmount,
						inline: true,
					},
					{
						name: '💫 Profit',
						value: displayProfit,
						inline: true,
					},
					{
						name: '🏆 Total Payout',
						value: displayPayout,
						inline: false,
					},
					{
						name: '📊 Balance Update',
						value: `${displayOldBalance} → ${displayNewBalance}`,
						inline: false,
					},
				)
				.setTimestamp()
				.setFooter({
					text: `Pluto | ${betIdLabel}`,
				})
		}

		case 'push': {
			const { team, displayBetAmount } =
				displayResult as DisplayResultPush

			return new EmbedBuilder()
				.setTitle('🔄 Bet Refunded - Tie Game')
				.setColor('#ffa500')
				.addFields(
					{ name: '🎯 Team Selected', value: team, inline: true },
					{
						name: '💵 Refunded Amount',
						value: displayBetAmount,
						inline: true,
					},
					{
						name: 'ℹ️ Reason',
						value: 'The match ended in a tie. Your bet has been refunded.',
						inline: false,
					},
				)
				.setTimestamp()
				.setFooter({
					text: `Pluto | ${betIdLabel}`,
				})
		}

		case 'lost': {
			const { team, displayBetAmount } =
				displayResult as DisplayResultLost

			return new EmbedBuilder()
				.setTitle('❌ Bet Lost')
				.setColor('#ff6961')
				.addFields(
					{ name: '🎯 Team Selected', value: team, inline: true },
					{
						name: '💸 Lost',
						value: displayBetAmount,
						inline: true,
					},
				)
				.setTimestamp()
				.setFooter({
					text: `Pluto | ${betIdLabel}`,
				})
		}
	}
}

// -------------------------------------------------------- E2 parlay result DMs

/**
 * Parlay result embeds (surface E2). Long parlays split their legs across
 * several embeds; production sends one DM per embed.
 */
export function parlayResultEmbeds(
	data: ParlayResultNotification,
): EmbedBuilder[] {
	const combinedOdds = formatAmericanOdds(data.combined_odds_american)

	const baseEmbed = new EmbedBuilder()
		.setTimestamp()
		.setFooter({ text: `Pluto | Parlay ID: ${data.parlay_id}` })
		.addFields({
			name: '📈 Combined Odds',
			value: combinedOdds,
			inline: true,
		})

	switch (data.kind) {
		case 'won': {
			// The published contract does not require payout for won
			// notifications, so surface an honest "Unavailable" rather than a
			// misleading $0.00 when neither amount is present.
			const wonPayout = data.actual_payout ?? data.payout
			baseEmbed
				.setTitle('🎉 Parlay Won! 🎉')
				.setColor('#57f287')
				.addFields(
					{
						name: '💰 Stake',
						value: MoneyFormatter.toUSD(data.stake),
						inline: true,
					},
					{
						name: '🏆 Payout',
						value:
							wonPayout === undefined
								? 'Unavailable'
								: MoneyFormatter.toUSD(wonPayout),
						inline: true,
					},
				)
			if (
				data.old_balance !== undefined &&
				data.new_balance !== undefined
			) {
				baseEmbed.addFields({
					name: '📊 Balance Update',
					value: `${MoneyFormatter.toUSD(data.old_balance)} → ${MoneyFormatter.toUSD(data.new_balance)}`,
					inline: false,
				})
			}
			break
		}
		case 'busted':
		case 'lost':
			baseEmbed
				.setTitle('❌ Parlay Busted')
				.setColor('#ff6961')
				.addFields({
					name: '💸 Lost',
					value: MoneyFormatter.toUSD(data.stake),
					inline: true,
				})
			break
		case 'push_refunded':
			baseEmbed
				.setTitle('🔄 Parlay Refunded')
				.setColor('#ffa500')
				.addFields({
					name: '💵 Refunded Amount',
					value: MoneyFormatter.toUSD(
						data.refund_amount ?? data.actual_payout ?? data.stake,
					),
					inline: true,
				})
				.addFields({
					name: 'ℹ️ Reason',
					value: 'All eligible legs pushed or were voided. Your stake has been refunded.',
					inline: false,
				})
			break
	}

	const groups = buildParlayLegFieldGroups(data)
	if (groups.length === 0) return [baseEmbed]
	return groups.map((fields, index) => {
		const embed =
			index === 0
				? baseEmbed
				: new EmbedBuilder()
						.setTitle('🧾 Parlay Legs (continued)')
						.setTimestamp()
						.setFooter({
							text: `Pluto | Parlay ID: ${data.parlay_id}`,
						})
		embed.addFields(...fields)
		return embed
	})
}

function buildParlayLegFieldGroups(
	data: ParlayResultNotification,
): Array<Array<{ name: string; value: string; inline: false }>> {
	const maxFieldLength = 800
	const maxFieldsPerEmbed = 20
	const maxLegCharactersPerEmbed = 4500
	const groups: Array<Array<{ name: string; value: string; inline: false }>> =
		[]
	let currentGroup: Array<{
		name: string
		value: string
		inline: false
	}> = []
	let currentLines: string[] = []
	let currentFieldLength = 0
	let currentGroupLength = 0

	const flushField = () => {
		if (currentLines.length === 0) return
		currentGroup.push({
			name:
				currentGroup.length === 0
					? '🧾 Legs'
					: `🧾 Legs (${currentGroup.length + 1})`,
			value: currentLines.join('\n'),
			inline: false,
		})
		currentLines = []
		currentFieldLength = 0
	}
	const flushGroup = () => {
		flushField()
		if (currentGroup.length === 0) return
		groups.push(currentGroup)
		currentGroup = []
		currentGroupLength = 0
	}

	for (const leg of data.legs) {
		const selection = leg.selection_display
		const shortenedSelection =
			selection.length > 350 ? `${selection.slice(0, 349)}…` : selection
		const line = `${parlayLegGlyph(leg.result)} ${shortenedSelection} (${formatAmericanOdds(leg.odds_american)})`
		if (
			currentLines.length > 0 &&
			currentFieldLength + line.length + 1 > maxFieldLength
		) {
			flushField()
		}
		if (
			currentGroup.length >= maxFieldsPerEmbed ||
			(currentGroupLength > 0 &&
				currentGroupLength + line.length + 1 > maxLegCharactersPerEmbed)
		) {
			flushGroup()
		}
		currentLines.push(line)
		currentFieldLength += line.length + 1
		currentGroupLength += line.length + 1
	}
	flushGroup()

	return groups
}

function parlayLegGlyph(
	result: ParlayResultNotification['legs'][number]['result'],
): string {
	switch (result) {
		case 'won':
			return '✅'
		case 'lost':
			return '❌'
		case 'pending':
			return '⏳'
		case 'push':
		case 'void':
			return '➖'
	}
}

// ------------------------------------------------------ E3 big-win announcement

/** Big parlay win in the betting channel (surface E3). */
export function bigWinParlayEmbed(input: BigWinParlayInput): EmbedBuilder {
	return new EmbedBuilder()
		.setTitle('💰 Big Parlay Win! 💰')
		.setDescription(`<@${input.userId}> just hit a huge parlay!`)
		.setColor(embedColors.success)
		.addFields(
			{
				name: '🧾 Legs',
				value: String(input.legs),
				inline: true,
			},
			{
				name: '📈 Combined Odds',
				value: formatAmericanOdds(input.combinedOddsAmerican),
				inline: true,
			},
			{
				name: '🏆 Payout',
				value: MoneyFormatter.toUSD(input.payout),
				inline: false,
			},
		)
		.setFooter({ text: `Parlay ID: ${input.parlayId}` })
		.setTimestamp()
}

/** Big single-bet win in the betting channel (surface E3). */
export function bigWinSingleBetEmbed(
	input: BigWinSingleBetInput,
): EmbedBuilder {
	return new EmbedBuilder()
		.setTitle('💰 Big Win! 💰')
		.setDescription(`<@${input.userId}> just landed a big win!`)
		.setColor(embedColors.success)
		.addFields(
			{
				name: '🎯 Selection',
				value: input.team,
				inline: true,
			},
			...(input.oddsAmerican === undefined
				? []
				: [
						{
							name: '📈 Odds',
							value: formatAmericanOdds(input.oddsAmerican),
							inline: true,
						},
					]),
			{
				name: '🏆 Payout',
				value: MoneyFormatter.toUSD(input.payout),
				inline: false,
			},
		)
		.setFooter({ text: `Bet ID: ${input.betId}` })
		.setTimestamp()
}
