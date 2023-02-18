import { allClosingLogs } from '../../logging.js'
import { db } from '#db'
import { LIVEMATCHUPS } from "#config"

/**
 * @module idApiExisting
 * Query DB for a match's API ID property. Used to check if a match is suppose to be closed, as the game score API call will return data for recent games.
 */
export async function idApiExisting(idApiKey) {
    await allClosingLogs.info(
        `[idApiExisting.js] Checking for API ID in DB >> ${idApiKey}`,
    )
    return await db.oneOrNone(
        `
    SELECT * FROM "${LIVEMATCHUPS}" WHERE idapi = $1`,
        [idApiKey],
    )
}
