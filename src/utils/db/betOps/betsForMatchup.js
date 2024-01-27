import { betsForTeam } from './betsForTeam.js'

/**
 * @module betsForMatchup
 * List all bets for a specified matchup
 * @references {@link betsForTeam} - Collect count of bets for a specific team
 * @param {string} homeTeam - The home team
 * @param {string} awayTeam - The away team
 */

export async function betsForMatchup(homeTeam, awayTeam) {
    var hTeamCount = await betsForTeam(homeTeam, 'home')
    var aTeamCount = await betsForTeam(awayTeam, 'away')
    var totalBets = hTeamCount + aTeamCount
}
