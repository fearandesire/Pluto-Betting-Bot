/**
 * @module determineWinner
 * Determine the winner of a game based on the scores. Intended to inspects from the API score object of a specific match.
 */
export async function determineWinner(scoreObj) {
    //# determine which prop is the home team's score and away team's score by matching the team name
    let hScoreProp
    let awScoreProp
    if (scoreObj.scores[0].name === scoreObj.home_team) {
        hScoreProp = scoreObj.scores[0]
        awScoreProp = scoreObj.scores[1]
    } else if (scoreObj.scores[0].name === scoreObj.away_team) {
        hScoreProp = scoreObj.scores[1]
        awScoreProp = scoreObj.scores[0]
    }

    //# determine winner based on the scores
    var homeScore = hScoreProp.score
    var awayScore = awScoreProp.score
    var winner = ''
    var homeOrAwayWon
    var losingTeam
    var losingTeamHomeOrAway
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
    return { winner, homeOrAwayWon, losingTeam, losingTeamHomeOrAway }
}
