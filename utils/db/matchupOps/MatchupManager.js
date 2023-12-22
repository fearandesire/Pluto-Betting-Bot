import _ from 'lodash'
import { formatISO, isBefore, parseISO } from 'date-fns'
import db from '@pluto-db'
import {
	SCORETABLE,
	LIVEBETS,
	LIVEMATCHUPS,
} from '@pluto-server-config'
import logClr from '@pluto-internal-color-logger'
import PlutoLogger from '@pluto-logger'
import IsoManager from '@pluto-iso-manager'
import resolveMatchup from './resolveMatchup.js'

export class MatchupManager {
	constructor() {
		this.team = null
		this.matchInfo = null
		this.oddsForTeam = null
	}

	static async storeMatchResult(matchData, dbCnx) {
		const { winner, loser, id } = matchData
		return dbCnx.none(
			`UPDATE "${LIVEMATCHUPS}" SET winner = $1, loser = $2 WHERE id = $3`,
			[winner, loser, id],
		)
	}

	async getMatchViaTeam(team) {
		this.matchInfo = await db.oneOrNone(
			`SELECT * FROM "${LIVEMATCHUPS}" WHERE teamone = $1 OR teamtwo = $1`,
			[team],
		)
		if (!this.matchInfo) {
			throw new Error({
				message: `Match not found for team ${team}`,
				code: 'MATCH_NOT_FOUND',
			})
		}
		await this.getOddsForTeam(this.matchInfo)
		return this
	}

	static async getOddsViaId(matchupApiId, team) {
		const matchInfo = await db.oneOrNone(
			`SELECT * FROM "${LIVEMATCHUPS}" WHERE id = $1`,
			[matchupApiId],
		)
		if (matchInfo.teamone === team) {
			return matchInfo.teamoneodds
		}

		return matchInfo.teamtwoodds
	}

	async getOddsForTeam(matchInfo, team) {
		// Identify which team is selected, return the odds for that team
		if (matchInfo.teamone === team) {
			this.oddsForTeam = matchInfo.teamoneodds
			return this
		}
		this.oddsForTeam = matchInfo.teamtwoodds
		return this
	}

	static async gameIsLive(id) {
		const dbMatchup = await db.oneOrNone(
			`SELECT * FROM "${LIVEMATCHUPS}" WHERE id = $1`,
			[id],
		)

		if (!dbMatchup) {
			// Handle the case where the matchup is not found
			return false
		}

		const gameStart = parseISO(dbMatchup.start)
		const now = new Date()
		return isBefore(gameStart, now)
	}

	/**
	 * Checks if a team has more than 1 match in the current week
	 * @param {string} team - Team to search for
	 * @returns {boolean | array}
	 */
	async repeatTeamCheck(team) {
		const teamCheck = await db
			.manyOrNone(
				`SELECT * FROM "${LIVEMATCHUPS}" WHERE teamone = $1 OR teamtwo = $1`,
				[team],
			)
			.catch((err) => {
				throw err
			})
		if (teamCheck.length > 1) {
			return teamCheck
		}
		return false
	}

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
			gameDate,
			start,
			cronStartTime,
			legibleStartTime,
			id,
		} = columnData

		return dbCnx
			.none(
				`INSERT INTO "${LIVEMATCHUPS}" (teamOne, teamTwo, teamOneOdds, teamTwoOdds, dateofmatchup, start, cronstart, legiblestart, id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
				[
					teamOne,
					teamTwo,
					teamOneOdds,
					teamTwoOdds,
					gameDate,
					start,
					cronStartTime,
					legibleStartTime,
					id,
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
