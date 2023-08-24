import { db } from '#db'

export default async function getConfig(configTblName) {
    const configTbl = await db.any(
        `SELECT * FROM ${configTblName}`,
    )
    return configTbl[0]
}
