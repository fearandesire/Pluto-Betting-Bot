import { db } from '../../Database/dbindex.js'

export function doesBetExist(userid, betid) {
	return db.oneOrNone(
		`SELECT * FROM betslips WHERE userid = $1 AND betid = $2`,
		[userid, betid],
	)
}
