import { LIVEMATCHUPS, dmMe } from '#config'
import { storeMatchupsLog } from '../../logging.js'
import { db } from '#db'

/**
 * @module storeMatchups -
 * Store a new matchup in the DB
 * @description - This function will take in the parameters listed below and populate a row in the DB
 * @param {obj} message - The message object containing the user & their message - also used to reference a direct reply to the user with message.reply()
 * @param {string} teamOne - The first team in the matchup (user input)
 * @param {string} teamTwo - The second team in the matchup (user input)
 * @param {integer} teamOneOdds - The odds of the first team (user input)
 * @param {integer} teamTwoOdds - The odds of the second team (user input)
 * @param {integer} matchupId - The id of the matchup (automatically generated)
 * @references {@link createMatchup.js} - This module is called from createMatchup.js - the command responsible for manually initiating a new matchup.
 */
export async function storeMatchups(colmdata) {
	storeMatchupsLog.info(`Initializing storeMatchups!`)

	const {
		teamOne,
		teamTwo,
		teamOneOdds,
		teamTwoOdds,
		matchupId,
		gameDate,
		startTimeISO,
		cronStartTime,
		legibleStartTime,
		idApi,
	} = colmdata

	db.none(
		`INSERT INTO "${LIVEMATCHUPS}" (matchid, teamOne, teamTwo, teamOneOdds, teamTwoOdds, dateofmatchup, "startTime", cronstart, legiblestart, idapi) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
		[
			matchupId,
			teamOne,
			teamTwo,
			teamOneOdds,
			teamTwoOdds,
			gameDate,
			startTimeISO,
			cronStartTime,
			legibleStartTime,
			idApi,
		],
	).catch(async (err) => {
		await storeMatchupsLog.error(
			`Error adding matchup to NBAactivematchups table\nData received:\nHome Team (teamOne): ${teamOne} Away Team (teamTwo): ${teamTwo}\nHome Team Odds: ${teamOneOdds} - Away Team Odds: ${teamTwoOdds}\nError Details:\n${err}`,
		)
		await dmMe(
			`Error adding matchup into ${LIVEMATCHUPS} table\nError Details:\n${err}`,
		)
		throw new Error(err)
	})
}
