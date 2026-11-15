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
import { PROP_ROW_TEXT_MAX_CHARS } from '../v2/prop-settlement.js'

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
	/** Scope token for the ephemeral Browse more list; omitted when unavailable. */
	browseToken?: string
}): V2MessagePayload {
	const { props, sport, teams, browseToken } = args
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
	if (browseToken) blocks.push(browseRow(browseToken))
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
	const line = [
		`**${prop.description}** • O/U${point} ${marketName}`,
		`Over ${formatPrice(prop.over.price)} • Under ${formatPrice(prop.under.price)}`,
	].join('\n')
	return line.length > PROP_ROW_TEXT_MAX_CHARS
		? `${line.slice(0, PROP_ROW_TEXT_MAX_CHARS - 1)}…`
		: line
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

/** Opens the whole day's props as an ephemeral, paginated list. */
export const BROWSE_CUSTOM_ID_PREFIX = 'props.browse.v1.'

export function propsBrowseCustomId(token: string): string {
	return `${BROWSE_CUSTOM_ID_PREFIX}${token}`
}

export function decodePropsBrowseCustomId(customId: string): string | null {
	if (!customId.startsWith(BROWSE_CUSTOM_ID_PREFIX)) return null
	const token = customId.slice(BROWSE_CUSTOM_ID_PREFIX.length)
	return /^[a-f0-9]{16}$/.test(token) ? token : null
}

function browseRow(
	token: string,
): ActionRowBuilder<MessageActionRowComponentBuilder> {
	return new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
		new ButtonBuilder()
			.setCustomId(propsBrowseCustomId(token))
			.setLabel('Browse more')
			.setEmoji('📋')
			.setStyle(ButtonStyle.Secondary),
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

/**
 * Every pair in the post as a per-game list for the ephemeral Browse more
 * view. Games run in tip-off order and pairs by player, matching the boards.
 */
export function boardBrowseLines(
	props: readonly ProcessedPropDto[],
	sport: 'nfl' | 'nba',
): string[] {
	const sportEmoji = sport === 'nfl' ? '🏈' : '🏀'
	const byEvent = new Map<string, ProcessedPropDto[]>()
	for (const prop of props) {
		const group = byEvent.get(prop.event_id) ?? []
		group.push(prop)
		byEvent.set(prop.event_id, group)
	}
	const tipoff = (group: ProcessedPropDto[]) =>
		Math.min(...group.map((prop) => Date.parse(prop.commence_time) || 0))
	const lines: string[] = []
	for (const group of [...byEvent.values()].sort(
		(left, right) => tipoff(left) - tipoff(right),
	)) {
		const first = group[0]
		const kickoff = kickoffStamp(first.commence_time)
		lines.push(
			[
				`### ${sportEmoji} ${first.away_team} vs. ${first.home_team}`,
				kickoff ?? null,
			]
				.filter(Boolean)
				.join(' · '),
		)
		for (const prop of [...group].sort(
			(left, right) =>
				left.description.localeCompare(right.description) ||
				left.market_key.localeCompare(right.market_key),
		)) {
			lines.push(
				`**${prop.description}** · ${marketName(prop)} · Over ${formatPrice(prop.over.price)} / Under ${formatPrice(prop.under.price)}`,
			)
		}
	}
	return lines
}

function marketName(prop: ProcessedPropDto): string {
	const name = StringUtils.toTitleCase(
		MarketKeyTranslations[prop.market_key] || prop.market_key,
	)
	return prop.point === null || prop.point === undefined
		? name
		: `${name} O/U \`${prop.point}\``
}
