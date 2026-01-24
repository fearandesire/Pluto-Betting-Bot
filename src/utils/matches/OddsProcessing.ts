import type { MatchDetailDto } from '@kh-openapi'
import { helpfooter } from '@pluto-config'
import { isValid, parseISO } from 'date-fns'
import _ from 'lodash'
import parseScheduledGames from '../bot_res/parseScheduled.js'
import { formatOdds } from './formatOdds.js'
import type { IOddsField } from './matchups.interface.js'

export async function prepareAndFormat(
	matchups: MatchDetailDto[],
	thumbnail: string,
	guildId?: string,
    userTZInput?: string,
) {
	const oddsFields: IOddsField[] = []

	let _completedCount = 0
	let _nullOddsCount = 0
	let _formatErrorCount = 0

	//let userTimezone = new Intl.DateTimeFormat().resolvedOptions().timeZone
	let myTZ = ''
	let userTimezone = 'Etc/UTC'
	if (userTZInput && userTZInput.trim().length)
		try { myTZ = new Date().toLocaleString('en-US',{timeZone:userTZInput.trim(),timeZoneName:'short'}) }
		catch { myTZ = new Date().toLocaleString('en-US',{timeZone:userTimezone,timeZoneName:'short'}) }
	let mydate = myTZ.split(' ')
	let mylen = mydate.length
	userTimezone = mydate[mylen-1].match(/^[AP]M$/) ? userTZInput.trim() : mydate[mylen-1] }
		
	for (const match of matchups) {
		if (match.status === 'completed') {
			_completedCount++
			continue
		}
		const homeTeam = `${match.home_team}`
		const awayTeam = `${match.away_team}`
		const homeOddsRaw = match.home_team_odds
		const awayOddsRaw = match.away_team_odds

		// Skip matches with missing odds
		if (homeOddsRaw == null || awayOddsRaw == null) {
			_nullOddsCount++
			continue
		}

		let homeOdds: string
		let awayOdds: string
		try {
			const formatted = await formatOdds(homeOddsRaw, awayOddsRaw)
			homeOdds = formatted.homeOdds
			awayOdds = formatted.awayOdds
		} catch (_error) {
			_formatErrorCount++
			continue
		}

		// Parse commence_time to get date and time components
		let commenceTime = ''
		let matchTime = ''
		let matchDay = ''

		if (match.commence_time) {
			try {
				const matchDate = parseISO(match.commence_time)
				if (isValid(matchDate)) {
					let formattedDateTime = matchDate.toLocaleString('en-US', {
						timeZone: userTimezone,
						//timeZoneName: 'short', // Don't Add Time Zone
					})

					matchDay = formattedDateTime.split(', ')[0]
					matchTime = formattedDateTime
						.split(', ')[1]
						.replace(/:\d\d /, ' ')
						//.replace(/ [A-Z]{3,5}$/, '') // Remove timezone - shown in date header
					commenceTime = match.commence_time
				}
			} catch {
				commenceTime = ''
				matchTime = ''
				matchDay = ''
			}
		}

		oddsFields.push({
			teams: {
				home_team: {
					name: homeTeam,
					odds: homeOdds,
				},
				away_team: {
					name: awayTeam,
					odds: awayOdds,
				},
			},
			dates: {
				mdy: matchDay,
				start: commenceTime,
				legible: matchTime,
			},
		})
	}

	// Sort the oddsFields by actual date
	const sortedOddsFields = _.orderBy(
		oddsFields,
		['dates.start', 'teams.home_team.name'],
		['asc', 'asc'],
	)

	const count = sortedOddsFields.length
	const options = {
		includeOdds: true,
		footer: {
			text: `\`${count}\` upcoming matches | ${await helpfooter('general')}`,
		},
		thumbnail,
		guildId,
		userTimezone: userTimezone,
	}

	return await parseScheduledGames(sortedOddsFields, options)
}
