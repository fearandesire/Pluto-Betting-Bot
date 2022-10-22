import { _, container, embedReply, flatcache } from '#config'

import currentWeekNumber from 'current-week-number'

/**
 * Return all matchups from cache
 * @return {object} Embed object displaying all matchups in cache
 */
export async function returnAllMatchups(message, input) {
	let todaysOddsCache = flatcache.create(`oddsCache.json`, './cache/dailyOdds')
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
		title: `Odds for Week# ${weekNum} (+Including next Monday)`,
		description: listedDescription,
		footer: `#${matchupCount} Total Matchups`,
		color: `#3a3694`,
		target: `reply`,
	}
	await embedReply(message, embedObj)
}
