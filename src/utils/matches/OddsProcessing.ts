import _ from 'lodash'
import parseScheduled from '../bot_res/parseScheduled.js'
import { formatOdds } from './formatOdds.js'
import { Matchup } from '../api/common/interfaces/common-interfaces.js'
import { IOddsField } from './matchups.interface.js'
import { patreonFooterUrl } from '../api/patreon/interfaces.js'
import { helpfooter } from '@pluto-core-config'
import type { Match } from '@khronos-index'

export async function prepareAndFormat(matchups: Match[], thumbnail: string) {
	const oddsFields: IOddsField[] = []
	for await (const match of Object.values(matchups)) {
		const hTeam = `${match.home_team}`
		const aTeam = `${match.away_team}`
		const hOdds = match.home_team_odds
		const aOdds = match.away_team_odds
		const { homeOdds, awayOdds } = await formatOdds(hOdds, aOdds)
		const parsedStart = match.legiblestart.split(', ')[1]
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
				mdy: match.dateofmatchup,
				start: parsedStart,
				legible: match.legiblestart,
			},
		})
	}

	// Sort the oddsFields by actual date
	const sortedOddsFields = _.orderBy(oddsFields, ['dates.mdy'], ['asc'])

	const count = sortedOddsFields.length
	const options = {
		includeOdds: true,
		footer: {
			text: `${count} upcoming matches | ${helpfooter()}`,
			iconURL: patreonFooterUrl,
		},
		thumbnail,
	}

	return await parseScheduled(sortedOddsFields, options)
}
