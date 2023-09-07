/**
 * Format + onto odds provided as 'negative' odds by default have the `-` character
 * @param {string | integer} homeOdds - Odds of the Home Team
 * @param {string | integer} awayOdds - Odds of the Away Team
 * @return {string} Returns the formatted odds
 */

export async function formatOdds(homeOdds, awayOdds) {
	let hOdds = homeOdds.toString()
	let aOdds = awayOdds.toString()
	const favorHome = hOdds.includes(`-`)
	const favorAway = aOdds.includes(`-`)
	if (favorHome && favorAway) {
		hOdds = `${hOdds}`
		aOdds = `${aOdds}`
	} else if (favorHome && !favorAway) {
		aOdds = `+${aOdds}` // away team underdog
	} else if (favorAway && !favorHome) {
		hOdds = `+${hOdds}` // home team underdog
	}
	return {
		homeOdds: hOdds,
		awayOdds: aOdds,
	}
}
