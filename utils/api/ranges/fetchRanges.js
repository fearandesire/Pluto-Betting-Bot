import _ from 'lodash'
import { db } from '#db'
import { RANGES } from '#serverConf'

export default async function fetchRanges() {
	const rows = await db.query(
		`SELECT range1, range2 FROM "${RANGES}"`,
	)
	const ranges = _.compact(_.flatMap(rows, _.values))
	console.log('ranges: ', ranges)
	return ranges
}
