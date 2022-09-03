import Fuse from 'fuse.js'
import { teamList } from '#lib/teamList'

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
        throw new Error(`Team ${teamName} not found.`)
    }
    //console.log(foundTeam)
    return foundTeam.item.name
}
