import _ from 'lodash'
import { formatISO } from 'date-fns'
import { db } from '#db'
import { LIVEMATCHUPS, LIVEBETS } from '#config'
import logClr from '#colorConsole'
import { SCORETABLE } from '#serverConf'
import PlutoLogger from '#PlutoLogger'
import IsoManager from '#iso'
import resolveMatchup from './resolveMatchup.js'

export class MatchupManager {

	/**
	 * Get upcoming games
	 */

	static async getUpcoming() {
		const games = await db
			.manyOrNone(
				`SELECT * FROM "${LIVEMATCHUPS}" WHERE inprogress = false OR inprogress IS NULL`,
			)
			.catch((err) => {
				throw err
			})
		return games
	}
	/**
	 * Locate matchup via ID
	 */

	static async getViaId(id, dbCnx) {
		const matchup = dbCnx.oneOrNone(
			`
		SELECT * FROM "${LIVEMATCHUPS}" WHERE id = $1`,
			[id],
		)
		if (!matchup) {
			return null
		}
		return matchup
	}

	/**
	 *  Get all matchups
	 */
	static async getAllMatchups() {
		const matchups = await db.manyOrNone(
			`SELECT * FROM "${LIVEMATCHUPS}"`,
		)
		return matchups
	}

	/**
	 *  Get matchups for a specific day
	 * If no date is provided, get matchups for the current day
	 * @param {string} ISODate - ISO 8601 Date
	 */
	static async matchupsForDay(ISODate) {
		/**
		 * Supplied the ISO Date String
		 * @type {string}  */
		let isoTime
		if (!ISODate) {
			const today = new Date()
			isoTime = formatISO(today, {
				representation: 'complete',
			})
		} else {
			isoTime = ISODate
		}
		const matchups = await db.manyOrNone(
			`SELECT * FROM "${LIVEMATCHUPS}"`,
		)
		const todaysMatches = _.filter(
			matchups,
			(matchup) =>
				new IsoManager(matchup.start, isoTime)
					.isSameDay,
		)
		return todaysMatches
	}

	/**
	 * Get the ID of the matchup
	 * @param {string} team - Team to locate the matchup ID for
	 * @returns {number} Matchup ID
	 */
	static async getMatchId(team) {
		const matchData = await resolveMatchup(team, `id`)
		return matchData
	}

	/**
	 * Locate bets that are placed for a specified team
	 * @param {string} team - Team to locate bets on the matchup
	 * @returns {boolean} True if found, false otherwise
	 */
	static async outstandingBets(id, dbCnx) {
		const bets = await dbCnx.any(
			`SELECT * FROM "${LIVEBETS}" WHERE matchid = '${id}'`,
		)
		if (_.isEmpty(bets)) {
			return false
		}
		return true
	}

	static async storeMatchups(columnData, dbCnx) {
		const {
			teamOne,
			teamTwo,
			teamOneOdds,
			teamTwoOdds,
			matchupId,
			gameDate,
			start,
			cronStartTime,
			legibleStartTime,
			idApi,
		} = columnData

		await dbCnx
			.none(
				`INSERT INTO "${LIVEMATCHUPS}" (matchid, teamOne, teamTwo, teamOneOdds, teamTwoOdds, dateofmatchup, start, cronstart, legiblestart, id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
				[
					matchupId,
					teamOne,
					teamTwo,
					teamOneOdds,
					teamTwoOdds,
					gameDate,
					start,
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
	static async rmvMatchupOdds(id, dbCnx) {
		try {
			await dbCnx.none(
				`DELETE FROM "${LIVEMATCHUPS}" WHERE id = $1`,
				[id],
			)
			return true
		} catch (err) {
			await PlutoLogger.log({
				id: 1,
				description: `Error occured removing matchup from the database.\nMatch ID: ${id}`,
			})
			return false
		}
	}
}
