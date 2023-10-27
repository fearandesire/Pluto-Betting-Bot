/**
 * @module determineWinner
 * Determine the winner of a game based on the scores. Designed to inspect the API score object of a specific match.
 */
export async function determineWinner(matchupObj) {
	// # determine which prop is the home team's score and away team's score by matching the team name
	let hScoreProp
	let awScoreProp
	if (
		matchupObj.scores[0].name === matchupObj.home_team
	) {
		;[hScoreProp, awScoreProp] = matchupObj.scores
	} else if (
		matchupObj.scores[0].name === matchupObj.away_team
	) {
		;[awScoreProp, hScoreProp] = matchupObj.scores
	}

	// # determine winner based on the scores
	const homeScore = hScoreProp.score
	const awayScore = awScoreProp.score
	let winner = ''
	let homeOrAwayWon
	let losingTeam
	let losingTeamHomeOrAway
	if (Number(homeScore) > Number(awayScore)) {
		winner = matchupObj.home_team
		homeOrAwayWon = 'home'
		losingTeam = matchupObj.away_team
		losingTeamHomeOrAway = 'away'
	} else if (Number(homeScore) < Number(awayScore)) {
		winner = matchupObj.away_team
		homeOrAwayWon = 'away'
		losingTeam = matchupObj.home_team
		losingTeamHomeOrAway = 'home'
	}
	return {
		winner,
		homeOrAwayWon,
		losingTeam,
		losingTeamHomeOrAway,
	}
}
