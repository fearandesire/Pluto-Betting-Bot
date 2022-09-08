import { flatcache } from '#config'
import { Command } from '@sapphire/framework'
import currentWeekNumber from 'current-week-number'
import _ from 'lodash'

export class viewAllMatchups extends Command {
	constructor(context, options) {
		super(context, {
			...options,
			name: 'viewAllMatchups',
			aliases: ['viewmatches'],
			description: '',
			requiredUserPermissions: ['KICK_MEMBERS'],
		})
	}
	async messageRun(message, args) {
		console.log(`All Matchups Yet;`)
		let todaysOddsCache = flatcache.create(
			`oddsCache.json`,
			'./cache/todaysOdds',
		)
		let matchupDescription = []
		var oddsCache = todaysOddsCache.getKey(`matchups`)
		await _.forEach(oddsCache, function (matchup) {
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
		var embedObj = {
			title: `Odds for Week# ${weekNum}`,
			description: listedDescription,
			color: `#3a3694`,
		}
		message.reply({ embeds: [embedObj] })
	}
}
