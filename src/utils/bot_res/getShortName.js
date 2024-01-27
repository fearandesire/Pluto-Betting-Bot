/**
 * @module getShortName
 * Get the short name of a team by splitting the team name by spaces.
 * @param {string} teamName - The team name we will split
 * @return {string} Returns the short name of the team (last word in the team name)
 */
export function getShortName(teamName) {
	const splitName = teamName.split(' ')
	const shortName = splitName[splitName.length - 1]
	return shortName
}
