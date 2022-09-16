import { Log } from '#config'
import { removeMatch } from '../../db/removeMatchup.js'

export async function handleComp(matchId) {
    Log.Yellow(`Closing matchup #${matchId}`)
    await removeMatch(matchId)
}
