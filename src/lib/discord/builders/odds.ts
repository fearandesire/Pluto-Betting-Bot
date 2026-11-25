import { type ColorResolvable, EmbedBuilder } from 'discord.js'
import type { IMatchupAggregated } from '../../../utils/api/common/interfaces/kh-pluto/kh-pluto.interface.js'
import type { PrepareMatchEmbed } from '../../../utils/cache/data/schemas.js'
import { buildRecordsStr } from '../../../utils/guilds/channels/matchEmbedUtils.js'
import embedColors from '../../colorsConfig.js'

/** A resolved guild emoji (stringifies to `<:name:id>`) or plain text. */
type EmojiLike = { toString(): string } | string | null | undefined

/** Daily schedule post (surface B2). `desc` is the joined game lines. */
export function dailyScheduleEmbed(desc: string) {
	// Make today's date string: `DD/MM/YYYY`
	const date = new Date()
	const today = date.toLocaleDateString('en-US', {
		month: '2-digit',
		day: '2-digit',
		year: 'numeric',
	})
	return new EmbedBuilder()
		.setDescription(`## Daily Schedule | ${today}\n${desc}`)
		.setColor(embedColors.PlutoRed as ColorResolvable)
		.setFooter({ text: 'dev. fenixforever' })
}

/**
 * One schedule line (surface B2). Emojis are the guild-emoji lookups; a
 * missing one falls back to the sport emoji.
 */
export function scheduleGameLine(
	game: IMatchupAggregated,
	emojis: { home: EmojiLike; away: EmojiLike },
) {
	// Define a mapping of sports to their corresponding emojis
	const sportEmojis: { [key: string]: string } = {
		nba: '🏀',
		nfl: '🏈',
	}

	// Extract the short names of the home and away teams
	const [homeTeamShort, awayTeamShort] = [game.home_team, game.away_team].map(
		(name) => name.split(' ').pop(),
	)

	const homeTeamEmoji =
		emojis.home ?? sportEmojis[game.sport_title.toLowerCase()]
	const awayTeamEmoji =
		emojis.away ?? sportEmojis[game.sport_title.toLowerCase()]

	// Convert the game's commence time to a Unix timestamp
	const unixTimestamp = Math.floor(
		new Date(game.commence_time).getTime() / 1000,
	)
	// Build and return the formatted string
	return `**${awayTeamEmoji} ${awayTeamShort} *(${game.teamRecords[1]})*** *\`at\`* **${homeTeamEmoji} ${homeTeamShort} *(${game.teamRecords[0]})*** @ *<t:${unixTimestamp}:t>*`
}

/**
 * A stored change is shown only while it agrees with the card's own facts: a
 * move only on a game that has not started, and a status only on a card that
 * already says the same thing.
 */
const agreedScheduleChange = (args: PrepareMatchEmbed) => {
	const change = args.scheduleChange
	if (!change) return undefined
	if (change.status === 'rescheduled' || change.status === 'delayed') {
		if (args.gameStatus !== 'scheduled') return undefined
		const tipoff = args.gametime ? new Date(args.gametime).getTime() : NaN
		return Math.abs(
			new Date(change.effective_start_time).getTime() - tipoff,
		) < 1000
			? change
			: undefined
	}
	return change.status === args.gameStatus ? change : undefined
}

const SCHEDULE_CHANGE_LABELS: Record<
	NonNullable<PrepareMatchEmbed['scheduleChange']>['status'],
	string
> = {
	postponed: 'Postponed',
	cancelled: 'Cancelled',
	rescheduled: 'Rescheduled',
	delayed: 'Delayed',
}

const unixSeconds = (value: Date | string) =>
	Math.floor(new Date(value).getTime() / 1000)

/** Game-channel match post (surface B3). `teamEmoji` is the favored team's. */
export function matchPostEmbed(args: PrepareMatchEmbed, teamEmoji: EmojiLike) {
	const matchVersus = `${args.awayTeamShortName} @ ${args.homeTeamShortName}`
	const recordsStr = buildRecordsStr(args)
	const bettingAvailable = args.bettingAvailable ?? Boolean(args.favored)
	const change = agreedScheduleChange(args)
	const label = change
		? SCHEDULE_CHANGE_LABELS[change.status]
		: args.gameStatus && args.gameStatus !== 'scheduled'
			? {
					live: 'Live',
					final: 'Final',
					postponed: 'Postponed',
					cancelled: 'Cancelled',
				}[args.gameStatus]
			: ''
	const reason =
		change?.reason && change.reason !== change.status
			? ` · ${change.reason}`
			: ''
	const status = label ? `\n\n**${label}${reason}**` : ''
	const tipoff =
		args.gametime && !['postponed', 'cancelled'].includes(args.gameStatus)
			? `\n\n<t:${unixSeconds(args.gametime)}:F>`
			: ''
	const movedFrom =
		change &&
		(change.status === 'rescheduled' || change.status === 'delayed') &&
		new Date(change.original_start_time).getTime() !==
			new Date(change.effective_start_time).getTime()
			? `\n*Was <t:${unixSeconds(change.original_start_time)}:F>*`
			: ''
	const favorite =
		bettingAvailable && args.favored
			? `\n\n> ${teamEmoji ?? ''}  **${args.favored}** opens as the favorite.`
			: ''
	const betting = bettingAvailable
		? `\n\n**Place your bets** → \`/commands\` in <#${args.bettingChanId}>`
		: ''
	return new EmbedBuilder()
		.setColor(
			args.favoredTeamClr ?? (embedColors.PlutoRed as ColorResolvable),
		)
		.setDescription(
			`# ${matchVersus}${status}${tipoff}${movedFrom}${favorite}${recordsStr}${betting}`,
		)
		.setFooter({
			text: 'Pluto | Created by fenixforever',
		})
}
