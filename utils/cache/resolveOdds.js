import { resolveOddsLog } from '../logging.js'

/**
 * Return matchup odds information from the CACHE based on the team name &  matchup id
 * @param {ParamDataTypeHere} parameterNameHere - Brief description of the parameter here. Note: For other notations of data types, please refer to JSDocs: DataTypes command.
 * @return {ReturnValueDataTypeHere} Brief description of the returning value here.
 */

export async function resolveOdds(data, betOnTeam) {
    switch (true) {
        case data.teamone == betOnTeam:
            var homeOdds = data.teamoneodds
            return homeOdds
        case data.teamtwo == betOnTeam:
            var awayOdds = data.teamtwoodds
            return awayOdds
        default:
            resolveOddsLog(`No odds found for ${betOnTeam}`)
            return
    }
}
