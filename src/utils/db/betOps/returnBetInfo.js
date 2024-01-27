import db from '@pluto-db'

/**
 * @module returnBetInfo
 * Return bet information from the database via the bet ID
 *
 */

export async function returnBetInfo(betid) {
	console.log(`Searching for bet ID: ${betid}`)
	return db.oneOrNone(
		`SELECT * FROM activebets WHERE betid = $1`,
		[betid],
	)
}
