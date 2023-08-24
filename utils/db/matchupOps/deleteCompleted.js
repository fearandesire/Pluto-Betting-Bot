import { db } from '#db'
import {
    PRESZN_MATCHUPS_TABLE,
    LIVEMATCHUPS,
} from '#config'
import logClr from '#colorConsole'

/**
 * Remove completed games from the DB
 *
 * @param {boolean} preseason
 */

export async function deleteCompletedMatches(
    preseason,
    id,
) {
    // # Delete the games that are completed
    if (preseason) {
        if (!id) {
            await db.none(
                `DELETE FROM "${PRESZN_MATCHUPS_TABLE}" WHERE completed = true`,
            )
            await logClr({
                text: `Cleared all completed matchups from the DB`,
                color: `green`,
                status: `done`,
            })
        } else {
            await db.none(
                `DELETE FROM "${PRESZN_MATCHUPS_TABLE}" WHERE id = $1`,
                [id],
            )
            await logClr({
                text: `Cleared matchup from DB with ID => ${id}`,
                color: `green`,
                status: `done`,
            })
        }
    }
}
