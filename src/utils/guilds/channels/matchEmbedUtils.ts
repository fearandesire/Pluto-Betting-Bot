import type { TeamMatchupRecords } from '../../cache/data/schemas.js'

interface RecordsArgs {
	records?: TeamMatchupRecords | null
	awayTeamShortName: string
	homeTeamShortName: string
}

export function buildRecordsStr(args: RecordsArgs): string {
	if (!args.records) return ''

	const { home_team, away_team, series } = args.records

	if (!series) {
		const recordsBlock =
			`### Records\n` +
			`\` ${args.awayTeamShortName} \`  ${away_team.total_record ?? '—'}\n` +
			`\` ${args.homeTeamShortName} \`  ${home_team.total_record ?? '—'}`
		return `\n\n${recordsBlock}`
	}

	const headerLine = `### 🏆 ${series.round ?? 'Playoff Series'}`
	const stateLine = buildSeriesStateLine({
		home_wins: series.home_wins,
		away_wins: series.away_wins,
		summary: series.summary,
		homeName: home_team.display_name ?? args.homeTeamShortName,
		awayName: away_team.display_name ?? args.awayTeamShortName,
	})

	return `\n\n${headerLine}${stateLine ? `\n${stateLine}` : ''}`
}

interface SeriesStateInput {
	home_wins?: number
	away_wins?: number
	summary?: string
	homeName: string
	awayName: string
}

function buildSeriesStateLine(input: SeriesStateInput): string | null {
	const { home_wins, away_wins, summary, homeName, awayName } = input

	if (home_wins !== undefined && away_wins !== undefined) {
		if (home_wins === away_wins) {
			return home_wins === 0
				? 'Series tied 0–0 — Game 1'
				: `Series tied ${home_wins}–${away_wins}`
		}
		const homeLeads = home_wins > away_wins
		const leaderName = homeLeads ? homeName : awayName
		const leaderWins = homeLeads ? home_wins : away_wins
		const trailerWins = homeLeads ? away_wins : home_wins
		return `**${leaderName}** lead the series ${leaderWins}–${trailerWins}`
	}

	return summary ?? null
}
