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

/** Game-channel match post (surface B3). `teamEmoji` is the favored team's. */
export function matchPostEmbed(args: PrepareMatchEmbed, teamEmoji: EmojiLike) {
	const matchVersus = `${args.awayTeamShortName} @ ${args.homeTeamShortName}`
	const recordsStr = buildRecordsStr(args)
	return new EmbedBuilder()
		.setColor(args.favoredTeamClr)
		.setDescription(
			`# ${matchVersus}\n\n> ${teamEmoji}  **${args.favored}** opens as the favorite.${recordsStr}\n\n**Place your bets** → \`/commands\` in <#${args.bettingChanId}>`,
		)
		.setFooter({
			text: 'Pluto | Created by fenixforever',
		})
}
