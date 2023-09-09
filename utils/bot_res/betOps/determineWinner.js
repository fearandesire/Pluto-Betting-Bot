/**
 * @module determineWinner
 * Determine the winner of a game based on the scores. Designed to inspect the API score object of a specific match.
 */
export async function determineWinner(scoreObj) {
	// # determine which prop is the home team's score and away team's score by matching the team name
	let hScoreProp
	let awScoreProp
	if (scoreObj.scores[0].name === scoreObj.home_team) {
		;[hScoreProp, awScoreProp] = scoreObj.scores
	} else if (
		scoreObj.scores[0].name === scoreObj.away_team
	) {
		;[awScoreProp, hScoreProp] = scoreObj.scores
	}

	// # determine winner based on the scores
	const homeScore = hScoreProp.score
	const awayScore = awScoreProp.score
	let winner = ''
	let homeOrAwayWon
	let losingTeam
	let losingTeamHomeOrAway
	if (Number(homeScore) > Number(awayScore)) {
		winner = scoreObj.home_team
		homeOrAwayWon = 'home'
		losingTeam = scoreObj.away_team
		losingTeamHomeOrAway = 'away'
	} else if (Number(homeScore) < Number(awayScore)) {
		winner = scoreObj.away_team
		homeOrAwayWon = 'away'
		losingTeam = scoreObj.home_team
		losingTeamHomeOrAway = 'home'
	}
	return {
		winner,
		homeOrAwayWon,
		losingTeam,
		losingTeamHomeOrAway,
	}
}
