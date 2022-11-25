/**
 * Format + onto odds provided as 'negative' odds by default have the `-` character
 * @param {string | integer} homeOdds - Odds of the Home Team
 * @param {string | integer} awayOdds - Odds of the Away Team
 * @return {string} Returns the formatted odds
 */
export async function formatOdds(homeOdds, awayOdds) {
    console.log(`homeOdds: ${homeOdds} | awayOdds: ${awayOdds}`)
    homeOdds = homeOdds.toString()
    awayOdds = awayOdds.toString()
    const favorHome = homeOdds.includes(`-`)
    const favorAway = awayOdds.includes(`-`)
    if (favorHome && favorAway) {
        homeOdds = `${homeOdds}`
        awayOdds = `${awayOdds}`
    } else if (favorHome && !favorAway) {
        awayOdds = `+${awayOdds}` // away team underdog
    } else if (favorAway && !favorHome) {
        homeOdds = `+${homeOdds}` // home team underdog
    }
    return {
        homeOdds: homeOdds,
        awayOdds: awayOdds,
    }
}
