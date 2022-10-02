import Fuse from 'fuse.js'
import { resolveTeamLog } from '../logging.js'
import { teamList } from '#lib/teamList'

/**
 * Resolve a team name using fuzzy search & comparison to the list of teams saved locally.
 * @param {string} teamName - The name of the team to search for
 * @return {ReturnValueDataTypeHere} Brief description of the returning value here.
 */

export async function resolveTeam(teamName) {
    var teams = teamList
    const options = {
        includeScore: true,
        keys: ['name'],
    }
    const fuse = new Fuse(teams, options)
    const result = fuse.search(`${teamName}`)
    var foundTeam = result[0]
    if (!foundTeam) {
        resolveTeamLog.error(`Unable to resolve team: ${teamName}`)
    }
    resolveTeamLog.info(`Resolved team: ${teamName} to ${foundTeam.item.name}`)
    //console.log(foundTeam)
    return foundTeam.item.name
}
