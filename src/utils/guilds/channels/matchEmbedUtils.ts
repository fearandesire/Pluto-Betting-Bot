import type { TeamMatchupRecords } from '../../cache/data/schemas.js'

interface RecordsArgs {
	records?: TeamMatchupRecords | null
	awayTeamShortName: string
	homeTeamShortName: string
}

export function buildRecordsStr(args: RecordsArgs): string {
	if (!args.records) return ''

	const { home_team, away_team, series } = args.records
	const isPlayoffs = Boolean(series)

	const awayRecord = isPlayoffs
		? (away_team.playoff_record ?? away_team.total_record)
		: away_team.total_record
	const homeRecord = isPlayoffs
		? (home_team.playoff_record ?? home_team.total_record)
		: home_team.total_record

	const awayLabel = isPlayoffs && awayRecord ? ' *(playoff)*' : ''
	const homeLabel = isPlayoffs && homeRecord ? ' *(playoff)*' : ''
	const recordsBlock = `🔵 **Team Records**\n${args.awayTeamShortName}: ${awayRecord ?? '—'}${awayLabel}\n${args.homeTeamShortName}: ${homeRecord ?? '—'}${homeLabel}`

	if (!series) return `\n\n${recordsBlock}`

	const seriesSummary =
		series.summary ??
		(series.home_wins !== undefined && series.away_wins !== undefined
			? `${args.awayTeamShortName} ${series.away_wins} – ${series.home_wins} ${args.homeTeamShortName}`
			: null)

	const seriesBlock = seriesSummary
		? `🏆 **Playoff Series${series.round ? ` — ${series.round}` : ''}**\n${seriesSummary}`
		: null

	return `\n\n${recordsBlock}${seriesBlock ? `\n\n${seriesBlock}` : ''}`
}
