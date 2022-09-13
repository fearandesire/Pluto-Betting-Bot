import { container, embedReply, flatcache, _ } from '#config'

import { Command } from '@sapphire/framework'
import currentWeekNumber from 'current-week-number'

export class viewAllMatchups extends Command {
	constructor(context, options) {
		super(context, {
			...options,
			name: 'viewAllMatchups',
			aliases: ['viewmatches', 'allmatchups'],
			description: '',
		})
	}
	async messageRun(message, args) {
		var input = await args.rest(`string`).catch(() => null)

		console.log(`All Matchups Yet;`)
		let todaysOddsCache = flatcache.create(
			`oddsCache.json`,
			'./cache/weeklyOdds',
		)
		let matchupDescription = []
		var oddsCache = todaysOddsCache.getKey(`matchups`)
		if (input === `debug`) {
			console.log(oddsCache)
		}
		container.allMatchupCount = 0

		await _.forEach(oddsCache, function (matchup) {
			container.allMatchupCount++
			var hTeam = matchup.home_team
			var aTeam = matchup.away_team
			var hOdds = matchup.home_teamOdds
			var aOdds = matchup.away_teamOdds
			var matchupId = matchup.matchupId
			var description = `**Matchup ID:** ${matchupId} | ${hTeam} **vs.** ${aTeam} | ${hOdds} **vs.** ${aOdds}\n━━━━━━━━`
			matchupDescription.push(description)
		})
		var weekNum = currentWeekNumber() + 1
		var listedDescription = matchupDescription.join(`\n`)
		let matchupCount = container.allMatchupCount
		var embedObj = {
			title: `Odds for Week# ${weekNum} (+ next Monday)`,
			description: listedDescription,
			footer: `#${matchupCount} Total Matchups`,
			color: `#3a3694`,
			target: `reply`,
		}
		await embedReply(message, embedObj)
	}
}
