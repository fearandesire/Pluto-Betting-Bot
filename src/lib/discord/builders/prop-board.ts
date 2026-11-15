import type { ProcessedPropDto } from '@pluto-khronos/api-client'
import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	type MessageActionRowComponentBuilder,
} from 'discord.js'
import { MarketKeyTranslations } from '../../../utils/api/common/interfaces/market-translations.js'
import StringUtils from '../../../utils/common/string-utils.js'
import {
	footer,
	text,
	type V2Item,
	type V2MessagePayload,
	v2Payload,
} from '../v2/kit.js'

/** One board holds at most four pairs so a settlement row stays readable. */
export const PROP_BOARD_MAX_PAIRS = 4

/** Team data the board needs; resolved by the caller (TeamInfo). */
export type PropBoardTeams = {
	/** resolve-team `abbrev` (a one-item array, interpolated as-is). */
	homeAbbrev: string | string[]
	awayAbbrev: string | string[]
	/** Home team colour as an integer. */
	homeColor: number
}

/**
 * One game's props as a Components V2 board: a heading, then each pair's text
 * followed by its own Over/Under row. The button custom IDs stay
 * `prop_<outcome_uuid>`, so existing handlers keep working.
 */
export function propBoardPayload(args: {
	props: readonly ProcessedPropDto[]
	sport: 'nfl' | 'nba'
	teams: PropBoardTeams
}): V2MessagePayload {
	const { props, sport, teams } = args
	const pairs = props.slice(0, PROP_BOARD_MAX_PAIRS)
	const sportEmoji = sport === 'nfl' ? '🏈' : '🏀'
	const kickoff = kickoffStamp(pairs[0]?.commence_time)

	const blocks: V2Item[] = [
		text('## 🎯 Accuracy Challenge'),
		text(
			[
				`### ${sportEmoji} ${teams.awayAbbrev} vs. ${teams.homeAbbrev}`,
				kickoff ? `${kickoff} • Player props` : 'Player props',
			].join('\n'),
		),
	]
	for (const prop of pairs) {
		blocks.push(text(propLine(prop)), choiceRow(prop))
	}
	blocks.push(footer('Tap Over or Under to pick. Each prop grades in place.'))

	return v2Payload({ blocks, accent: teams.homeColor })
}

/** Discord timestamp so every viewer reads the tip-off in their own zone. */
function kickoffStamp(commenceTime: string | undefined): string | null {
	if (!commenceTime) return null
	const millis = Date.parse(commenceTime)
	if (!Number.isFinite(millis)) return null
	return `<t:${Math.floor(millis / 1000)}:f>`
}

function propLine(prop: ProcessedPropDto): string {
	const marketName = StringUtils.toTitleCase(
		MarketKeyTranslations[prop.market_key] || prop.market_key,
	)
	const point =
		prop.point === null || prop.point === undefined
			? ''
			: ` \`${prop.point}\``
	return [
		`**${prop.description}** • O/U${point} ${marketName}`,
		`Over ${formatPrice(prop.over.price)} • Under ${formatPrice(prop.under.price)}`,
	].join('\n')
}

function formatPrice(price: number): string {
	return `${price > 0 ? '+' : ''}${price}`
}

function choiceRow(
	prop: ProcessedPropDto,
): ActionRowBuilder<MessageActionRowComponentBuilder> {
	return new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
		choiceButton(prop.over.outcome_uuid, 'Over', '⬆️', ButtonStyle.Success),
		choiceButton(prop.under.outcome_uuid, 'Under', '⬇️', ButtonStyle.Danger),
	)
}

function choiceButton(
	outcomeUuid: string,
	label: string,
	emoji: string,
	style: ButtonStyle,
): ButtonBuilder {
	return new ButtonBuilder()
		.setCustomId(`prop_${outcomeUuid}`)
		.setLabel(label)
		.setEmoji(emoji)
		.setStyle(style)
}
