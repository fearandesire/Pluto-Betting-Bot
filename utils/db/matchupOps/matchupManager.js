import _ from 'lodash'
import { db } from '#db'
import { LIVEMATCHUPS, BETSLIPS } from '#config'
import { resolveMatchup } from '#cacheUtil/resolveMatchup'
import logClr from '#colorConsole'
import { SCORETABLE } from '#serverConf'
import PlutoLogger from '#PlutoLogger'

export class MatchupManager {
	/**
	 * Locate bets that are placed for a specified team
	 * @param {string} team - Team to locate bets on the matchup
	 * @returns {boolean} True if found, false otherwise
	 */
	static async outstandingBets(team) {
		const matchData = await resolveMatchup(team)
		// use ID to find if there's any bets
		const { matchid } = matchData
		// check BETSLIPS for any bets with matchid
		const bets = await db.any(
			`SELECT * FROM "${BETSLIPS}" WHERE matchid = '${matchid}'`,
		)
		if (_.isEmpty(bets)) {
			return false
		}
		return true
	}

	static async storeMatchups(columnData) {
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
		} = columnData

		await db
			.none(
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
			)
			.catch(async (err) => {
				await PlutoLogger.log({
					title: `DB Logs`,
					description: `Error adding matchup into ${LIVEMATCHUPS} table\nError: \`${err?.message}\``,
				})
				throw new Error(err)
			})
	}

	/**
	 * @public
	 * @method clearOddsTable
	 * Remove matchups from the matchups table responsible for keeping track of odds for bets (Odds Table)
	 */
	static async clearOddsTable() {
		await db
			.oneOrNone(`DELETE FROM "${LIVEMATCHUPS}"`)
			.catch(async () =>
				PlutoLogger.log({
					title: `DB Logs`,
					description: `Error occured when clearing the Odds Matchup table.`,
				}),
			)
	}

	/**
	 * @public
	 * @method clearScoreTable
	 * Remove completed games, or a single completed game from the Scores Table in the DB
	 * @param {string} id - ID of the game. If not provided, all matchups in the table will be removed
	 */

	static async clearScoreTable(id) {
		// # Delete the games that are completed
		if (!id) {
			await db.none(
				`DELETE FROM "${SCORETABLE}" WHERE completed = true`,
			)
			await logClr({
				text: `Cleared all completed matchups from the DB`,
				color: `green`,
				status: `done`,
			})
		} else {
			await db.none(
				`DELETE FROM "${SCORETABLE}" WHERE id = $1`,
				[id],
			)
			await logClr({
				text: `Cleared matchup from DB with ID => ${id}`,
				color: `green`,
				status: `done`,
			})
		}
	}

	/**
	 * @public
	 * @method rmvMatchupOdds
	 * Remove specified matchups from the odds matchup table
	 * @param {string} hTeam - Home team
	 * @param {string} aTeam - Away team
	 */
	static async rmvMatchupOdds(hTeam, aTeam) {
		try {
			await db.none(
				`DELETE FROM "${LIVEMATCHUPS}" WHERE teamone = $1 AND teamtwo = $2`,
				[hTeam, aTeam],
			)
			return true
		} catch (err) {
			await PlutoLogger.log({
				id: 1,
				description: `Error occured removing matchup ${hTeam} vs ${aTeam} from the database`,
			})
			return false
		}
	}
}
