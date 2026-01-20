import type { MatchDetailDto } from '@kh-openapi'
import { helpfooter } from '@pluto-config'
import { format, isValid, parseISO } from 'date-fns'
import _ from 'lodash'
import parseScheduledGames from '../bot_res/parseScheduled.js'
import { logger } from '../logging/WinstonLogger.js'
import { formatOdds } from './formatOdds.js'
import type { IOddsField } from './matchups.interface.js'

export async function prepareAndFormat(
	matchups: MatchDetailDto[],
	thumbnail: string,
	guildId?: string,
) {
	const oddsFields: IOddsField[] = []

	let _completedCount = 0
	let _nullOddsCount = 0
	let _formatErrorCount = 0

	let tzone0 = new Intl.DateTimeFormat().resolvedOptions().timeZone
	tzone0 = tzone0 && tzone0.trim().length ? tzone0 : 'Etc/UTC'

	for (const match of matchups) {
		if (match.status === 'completed') {
			_completedCount++
			continue
		}
		const hTeam = `${match.home_team}`
		const aTeam = `${match.away_team}`
		const hOdds = match.home_team_odds
		const aOdds = match.away_team_odds

		// Skip matches with missing odds
		if (hOdds == null || aOdds == null) {
			_nullOddsCount++
			continue
		}

		let homeOdds: string
		let awayOdds: string
		try {
			const formatted = await formatOdds(hOdds, aOdds)
			homeOdds = formatted.homeOdds
			awayOdds = formatted.awayOdds
		} catch (_error) {
			_formatErrorCount++
			continue
		}

		// Parse commence_time to get date and time components
		let parsedStart = ''
		let legiblestart = ''
		let dateofmatchup = ''

		if (match.commence_time) {
			try {
				const matchDate = parseISO(match.commence_time)
				if (isValid(matchDate)) {
					let usdate = matchDate.toLocaleString('en-US', {
						timeZone: tzone0,
					})

					dateofmatchup = usdate.split(', ')[0]
					legiblestart = usdate.split(', ')[1].replace(/:\d\d /, ' ')
					parsedStart = match.commence_time

					//dateofmatchup = dateManager.toMMDDYYYY(matchDate)
					//legiblestart = format(matchDate, 'EEEE, h:mm a') // e.g., "Monday, 7:00 PM"
					//const commaIndex = legiblestart.indexOf(', ')
					//parsedStart =
					//	commaIndex !== -1
					//		? legiblestart.slice(commaIndex + 2)
					//		: format(matchDate, 'h:mm a')
				}
			} catch {
				parsedStart = ''
				legiblestart = ''
				dateofmatchup = ''
			}
		}

		oddsFields.push({
			teams: {
				home_team: {
					name: hTeam,
					odds: homeOdds,
				},
				away_team: {
					name: aTeam,
					odds: awayOdds,
				},
			},
			dates: {
				mdy: dateofmatchup,
				start: parsedStart,
				legible: legiblestart,
			},
		})
	}

	// Sort the oddsFields by actual date
	const sortedOddsFields = _.orderBy(
		oddsFields,
		['dates.start', 'teams.home_team.name'],
		['asc', 'asc'],
	)
	//const sortedOddsFields = _.orderBy(oddsFields, ['dates.mdy'], ['asc'])

	const count = sortedOddsFields.length
	const options = {
		includeOdds: true,
		footer: {
			text: `\`${count}\` upcoming matches | ${await helpfooter('general')}`,
		},
		thumbnail,
		guildId,
		tzone0,
	}

	return await parseScheduledGames(sortedOddsFields, options)
}
