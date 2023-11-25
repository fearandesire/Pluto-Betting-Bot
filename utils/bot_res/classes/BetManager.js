import { db } from '#db'

export default class BetManager {
	/**
	 * Constructor function for creating an instance of the class.
	 *
	 * @param {object} tables - The tables object containing BETSLIPS and PROFILES.
	 * @param {string} tables.BETSLIPS - The name of the BETSLIPS table.
	 * @param {string} tables.PROFILES - The name of the PROFILES table.
	 */
	constructor(tables) {
		this.LIVEBETS = tables.LIVEBETS
		this.BETSLIPS = tables.BETSLIPS
		this.PROFILES = tables.PROFILES
	}

	async currentBets() {
		const bets = await db.manyOrNone(
			`SELECT * FROM "${this.LIVEBETS}"`,
		)
		return bets
	}

	/**
	 * Retrieves all bets from the database.
	 *
	 * @return {Promise<Array>} An array of bet objects.
	 * @example
	 * 
	 * ```js
	   [
	   {
	   betid: number,
	   userid: number,
	   teamid: string,
	   matchid: number,
	   amount: number,
	   dateofbet: string
	   },
	   ...
	   ]
	  ```
	 */
	async allBets() {
		const bets = await db.manyOrNone(
			`SELECT * FROM "${this.BETSLIPS}"`,
		)
		return bets
	}

	async betsViaId(id) {
		const bets = await db.manyOrNone(
			`SELECT * FROM "${this.BETSLIPS}" WHERE id = $1`,
			[id],
		)
		return bets
	}

	async allBettingProfiles() {
		const profiles = await db.manyOrNone(
			`SELECT * FROM "${this.PROFILES}"`,
		)
		return profiles
	}

	async bettingProfilesViaId(id) {
		const profiles = await db.manyOrNone(
			`SELECT * FROM "${this.PROFILES}" WHERE id = $1`,
			[id],
		)
		return profiles
	}
}
