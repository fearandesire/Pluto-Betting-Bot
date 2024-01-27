import db from '@pluto-db'

export default async function getConfig(configTblName) {
	const configTbl = await db.any(
		`SELECT * FROM ${configTblName}`,
	)
	return configTbl[0]
}
