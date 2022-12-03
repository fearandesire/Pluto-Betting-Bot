import Fuse from 'fuse.js'
import { resolveTeamLog } from '../logging.js'
import { teamList } from '#lib/teamList'
import { teamColors } from '#lib/teamColors'

/**
 * Resolve a team name using fuzzy search & comparison to the list of teams saved locally.
 * @param {string} teamName - The name of the team to search for
 * @return {string} The name of the team that was found, or null if no team was found.
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
        await resolveTeamLog.error({
            status: `No Data`,
            errorMsg: `No team found for ${teamName}`,
        })
        return null
    }
    return foundTeam.item.name
}

/**
 * @module resolveTeamColor
 * Resolve a team color using fuzzy search & comparison to the list of teams saved locally.
 * @param {string} teamName - The name of the team to search for
 * @return {string} The first/primary color of the team that was found, or null if no team was found.
 */

export async function resolveTeamColor(teamName) {
    var teams = teamColors
    const options = {
        includeScore: true,
        keys: ['name'],
    }
    const fuse = new Fuse(teams, options)
    const result = fuse.search(`${teamName}`)
    var foundTeam = result[0]
    if (!foundTeam) {
        await resolveTeamLog.error({
            status: `No Data`,
            errorMsg: `No team found for ${teamName}`,
        })
        return null
    }
    return foundTeam.item.colors[0]
}
