/**
 * @module checkProgress
 * @summary Check if a matchup is in the process of having it's bets closed
 * @param {string} homeTeam - The home team
 * @param {string} awayTeam - The away team
 * @returns {boolean | string} - No data results in a return of a string with the value 'empty'; True if the matchup is in progress, false if not;
 */

import { inProgress } from './inProgress.js'

export async function checkBetQueue(homeTeam, awayTeam) {
	// Check if the provided matchup is currently being processed
	const progCheck = await inProgress(
		homeTeam,
		awayTeam,
	).then((res) => {
		if (!res) {
			// If the matchup is not in progress, return 'empty'
			return 'empty'
		}
		const inProg = res?.inprogress
		if (inProg === true) {
			// If the matchup is in progress, return true
			return true
		}
		// If the matchup is not in progress, return false
		return false
	})
	return progCheck
}
