import { db } from '#db'

/**
 * @module betsForTeam
 * Count the number of bets for a specific team
 */
export async function betsForTeam(team, homeOrAway) {
    return db.tx(async (t) => {
        switch (homeOrAway) {
            case 'home':
                homeOrAway = `teamone`
                break
            case 'away':
                homeOrAway = `teamtwo`
                break
        }
        var betsForTeam = await t.oneOrNone(
            `SELECT COUNT(*) FROM activebets WHERE "${homeOrAway}" = $1`,
            [team],
        )
        return betsForTeam.count
    })
}
