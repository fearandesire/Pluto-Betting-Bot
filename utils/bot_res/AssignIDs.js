import { Log } from './send_functions/consoleLog.js'

//? Util functions to generate unique IDs
export function AssignBetID() {
    const id = Math.floor(Math.random() * 10000)
    Log.BrightBlue(`[AssignID.js] Assigned Bet ID: ${id}`)
    return id
}

export function assignMatchID() {
    const matchId = Math.floor(Math.random() * 10000)
    Log.BrightBlue(`[assignMatchID.js] Assigned Bet ID: ${matchId}`)
    return matchId
}
