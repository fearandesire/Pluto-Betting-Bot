import { Log } from '#LogColor'

//? Util functions to generate unique IDs
export async function AssignBetID() {
    const id = Math.floor(Math.random() * 10000)
    Log.BrightBlue(`[AssignID.js] Assigned Bet ID: ${id}`)
    return id
}

export async function assignMatchID() {
    const matchId = Math.floor(Math.random() * 10000)
    Log.BrightBlue(`[AssignIDs.js] Assigned ID: ${matchId}`)
    return matchId
}
